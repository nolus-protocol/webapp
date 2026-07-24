/**
 * History Store - Transaction history and pending transfers
 *
 * Manages:
 * - Pending transfer tracking (send/receive operations in progress)
 * - Historical transaction list from ETL
 * - Activity feed for the UI
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { h } from "vue";
import { CONFIRM_STEP, type IObjectKeys } from "@/common/types";
import { HISTORY_ACTIONS } from "@/modules/history/types";
import type { TransactionEntry } from "@/modules/history/types/ITransaction";
import { useConfigStore } from "@/common/stores/config";
import { formatTokenBalance, formatCoinPretty } from "@/common/utils/NumberFormatUtils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { BackendApi } from "@/common/api";
import { useWalletWatcher } from "@/common/composables/useWalletWatcher";
import { getCreatedAtForHuman, TextFormat } from "@/common/utils";
import { action, icon as iconFn, message } from "@/modules/history/common";
import { i18n } from "@/i18n";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";
import type { TxEntry, TransactionFilters } from "@/common/api/types";
import type { CurrencyInfo } from "@/common/api";
import type { CoinPretty } from "@keplr-wallet/unit";
import type { MediumStep, MediumStepperProps, SmallStepperProps } from "web-components";

type PendingEntryData = TransactionEntry["historyData"] & IObjectKeys;

// `message` historically returns `[label, null]` for plain entries — the coin slot
// can be null at runtime even though HistoryData declares CoinPretty (pre-existing gap).
type MessageParts = [string, CoinPretty, SmallStepperProps?, MediumStepperProps?];

function isMessageParts(parts: unknown[]): parts is MessageParts {
  return typeof parts[0] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Pending entries carry no runtime `timestamp` even though the shared HistoryData
// type declares one (pre-existing gap); the guard checks the fields this store sets.
function isPendingEntryData(data: IObjectKeys): data is PendingEntryData {
  return typeof data.msg === "string" && typeof data.action === "string" && typeof data.icon === "string";
}

function getChainDisplay(
  chains: Record<string, unknown>,
  chainId: unknown
): { icon: string; label: string } | undefined {
  if (typeof chainId !== "string" && typeof chainId !== "number") {
    return undefined;
  }
  const chain = chains[String(chainId)];
  if (!isRecord(chain)) {
    return undefined;
  }
  const { icon, label } = chain;
  if (typeof icon !== "string" || typeof label !== "string") {
    return undefined;
  }
  return { icon, label };
}

/** i18n composer wrapped into the IObjectKeys shape the history formatters accept */
const i18nGlobal: IObjectKeys = {
  t: (...args: unknown[]) => {
    const [key, named] = args;
    if (typeof key !== "string") {
      throw new Error("translation key must be a string");
    }
    return isRecord(named) ? i18n.global.t(key, named) : i18n.global.t(key);
  }
};

export const useHistoryStore = defineStore("history", () => {
  // ==========================================================================
  // State
  // ==========================================================================

  /** Pending transfers indexed by ID */
  const pendingTransfers = ref<{ [key: string]: TransactionEntry }>({});

  /** Historical activities from ETL */
  const activities = ref<{ data: TransactionEntry[]; loaded: boolean }>({ data: [], loaded: false });

  /** Full transaction history (paginated) */
  const transactions = ref<TransactionEntry[]>([]);
  const transactionsLoading = ref(false);
  const transactionsLoaded = ref(false);

  /** Current wallet address */
  const address = ref<string | null>(null);

  /** Initialization state */
  const initialized = ref(false);

  // ==========================================================================
  // Computed
  // ==========================================================================

  /**
   * Get pending transfers sorted by ID (newest first)
   */
  const pendingTransfersList = computed(() =>
    Object.values(pendingTransfers.value).sort((a, b) => Number(b.historyData.id) - Number(a.historyData.id))
  );

  /**
   * Check if there are any pending transfers
   */
  const hasPendingTransfers = computed(() => Object.keys(pendingTransfers.value).length > 0);

  /**
   * Check if activities are loaded
   */
  const activitiesLoaded = computed(() => activities.value.loaded);

  /**
   * Check if all transactions are loaded
   */
  const allTransactionsLoaded = computed(() => transactionsLoaded.value);

  // ==========================================================================
  // Actions - Pending Transfers
  // ==========================================================================

  /**
   * Add or update a pending transfer
   * Called when initiating a send/receive operation
   */
  function addPendingTransfer(historyData: IObjectKeys, i18nInstance: { t: unknown }): void {
    const configStore = useConfigStore();
    const t = i18nInstance.t;
    if (typeof t !== "function") {
      throw new Error("history store requires an i18n instance exposing t()");
    }
    const translate = (key: string, params?: Record<string, unknown>): string =>
      String(params === undefined ? t(key) : t(key, params));

    const id = historyData.id;
    if (typeof id !== "string" && typeof id !== "number") {
      throw new Error("pending transfer payload is missing an id");
    }
    const skipRoute = historyData.skipRoute;
    if (!isRecord(skipRoute)) {
      throw new Error("pending transfer payload is missing a skip route");
    }
    const chains = isRecord(historyData.chains) ? historyData.chains : {};
    const denom = historyData.currency;
    const currency = typeof denom === "string" ? configStore.getCurrencyByDenom(denom) : undefined;

    switch (historyData.type) {
      case HISTORY_ACTIONS.RECEIVE: {
        const amountOut = skipRoute.amount_out;
        if (typeof amountOut !== "string") {
          throw new Error("receive transfer is missing its amount_out");
        }
        const fromAddress = historyData.fromAddress;
        if (typeof fromAddress !== "string") {
          throw new Error("receive transfer is missing its sender address");
        }
        const token = CurrencyUtils.convertMinimalDenomToDenom(
          amountOut,
          currency?.ibcData ?? "",
          currency?.shortName ?? "",
          Number(currency?.decimal_digits)
        );
        historyData.msg = translate("message.receive-action", {
          amount: formatCoinPretty(token),
          address: TextFormat.truncateString(fromAddress, 6, 6)
        });
        Object.assign(historyData, { coin: token });
        break;
      }
      case HISTORY_ACTIONS.SEND: {
        const amountIn = skipRoute.amount_in;
        if (typeof amountIn !== "string") {
          throw new Error("send transfer is missing its amount_in");
        }
        const receiverAddress = historyData.receiverAddress;
        if (typeof receiverAddress !== "string") {
          throw new Error("send transfer is missing its receiver address");
        }
        const token = CurrencyUtils.convertMinimalDenomToDenom(
          amountIn,
          currency?.ibcData ?? "",
          currency?.shortName ?? "",
          Number(currency?.decimal_digits)
        );
        historyData.msg = translate("message.send-action", {
          amount: formatCoinPretty(token),
          address: TextFormat.truncateString(receiverAddress, 6, 6)
        });
        Object.assign(historyData, { coin: token });
        break;
      }
    }

    historyData.action = translate("message.transfer-history");
    historyData.icon = "assets";
    historyData.routeDetails = {
      steps: getRouteSteps(skipRoute, translate, currency, chains),
      activeStep: 0
    };
    historyData.route = {
      steps: getRouteSteps(skipRoute, translate, currency, chains),
      activeStep: 0
    };
    historyData.status = CONFIRM_STEP.PENDING;

    if (!isPendingEntryData(historyData)) {
      throw new Error(`pending transfer of type ${String(historyData.type)} cannot be assembled into a display entry`);
    }
    pendingTransfers.value[id] = { historyData };
  }

  /**
   * Get a pending transfer by ID
   */
  function getPendingTransfer(id: string): TransactionEntry | undefined {
    return pendingTransfers.value[id];
  }

  /**
   * Update a pending transfer's status
   */
  function updatePendingTransferStatus(id: string, status: CONFIRM_STEP): void {
    if (pendingTransfers.value[id]) {
      pendingTransfers.value[id].historyData.status = status;
    }
  }

  /**
   * Update a pending transfer's step
   */
  function incrementPendingTransferStep(id: string): void {
    const transfer = pendingTransfers.value[id];
    if (transfer === undefined) {
      return;
    }
    const { route, routeDetails } = transfer.historyData;
    if (route === undefined || routeDetails === undefined) {
      console.error(`[HistoryStore] Pending transfer ${id} has no route steps to advance`);
      return;
    }
    route.activeStep++;
    routeDetails.activeStep++;
  }

  /**
   * Mark a pending transfer as complete
   */
  function completePendingTransfer(id: string): void {
    const transfer = pendingTransfers.value[id];
    if (transfer === undefined) {
      return;
    }
    const { route, routeDetails } = transfer.historyData;
    if (route !== undefined && routeDetails !== undefined) {
      route.activeStep = route.steps.length;
      routeDetails.activeStep = routeDetails.steps.length;
    } else {
      console.error(`[HistoryStore] Pending transfer ${id} has no route steps to complete`);
    }
    transfer.historyData.status = CONFIRM_STEP.SUCCESS;
  }

  /**
   * Mark a pending transfer as failed
   */
  function failPendingTransfer(id: string, errorMsg: string): void {
    const transfer = pendingTransfers.value[id];
    if (transfer === undefined) {
      return;
    }
    transfer.historyData.errorMsg = errorMsg;

    const { route, routeDetails } = transfer.historyData;
    if (route !== undefined && routeDetails !== undefined) {
      // Mark current step as failed
      const activeStep = route.activeStep;
      const step = route.steps[activeStep];
      if (step !== undefined) {
        Object.assign(step, { status: "failed" });
      }
      const detailsStep = routeDetails.steps[activeStep];
      if (detailsStep !== undefined) {
        Object.assign(detailsStep, { status: "failed" });
      }
    } else {
      console.error(`[HistoryStore] Pending transfer ${id} has no route steps to mark as failed`);
    }

    transfer.historyData.status = CONFIRM_STEP.ERROR;
  }

  /**
   * Set transaction hashes for a pending transfer
   */
  function setTransferTxHashes(id: string, txHashes: string[]): void {
    const transfer = pendingTransfers.value[id];
    if (transfer === undefined) {
      return;
    }
    transfer.historyData.txHashes = txHashes;
  }

  /**
   * Remove a pending transfer
   */
  function removePendingTransfer(id: string): void {
    delete pendingTransfers.value[id];
  }

  /**
   * Clear all pending transfers
   */
  function clearPendingTransfers(): void {
    pendingTransfers.value = {};
  }

  // ==========================================================================
  // Actions - Transactions (Full History)
  // ==========================================================================

  /**
   * Transform raw ETL transactions to display format
   */
  function transformTransactions(rawTxs: TxEntry[], _walletAddress: string): (IObjectKeys & { timestamp: Date })[] {
    return rawTxs.map((item) => {
      return {
        ...item,
        timestamp: new Date(item.timestamp)
      };
    });
  }

  /**
   * Fetch paginated transaction history
   * @param skip Number of transactions to skip
   * @param limit Max transactions to fetch
   * @param filters Optional filters
   * @param refresh If true, clears existing transactions
   * @returns The fetched transactions
   */
  async function fetchTransactions(
    skip: number = 0,
    limit: number = 50,
    filters: TransactionFilters = {},
    refresh: boolean = false
  ): Promise<TransactionEntry[]> {
    if (!address.value) {
      transactions.value = [];
      return [];
    }

    const voteMessages: { [key: string]: string } = {
      [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.global.t("message.abstained").toLowerCase(),
      [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.global.t("message.veto").toLowerCase(),
      [VoteOption.VOTE_OPTION_YES]: i18n.global.t("message.yes").toLowerCase(),
      [VoteOption.VOTE_OPTION_NO]: i18n.global.t("message.no").toLowerCase()
    };

    transactionsLoading.value = true;

    try {
      const rawTxs = await BackendApi.getTransactions(address.value, skip, limit, filters);
      const transformedTxs = transformTransactions(rawTxs, address.value);
      const currentAddress = address.value ?? "";

      // Process each transaction with message formatting
      const promises = transformedTxs.map(async (d): Promise<TransactionEntry | undefined> => {
        const parts = await message(d, currentAddress, i18nGlobal, voteMessages);
        if (!isMessageParts(parts)) {
          console.error("[HistoryStore] Skipping transaction with unrecognized message shape:", d.tx_hash);
          return undefined;
        }
        const [msg, coin, route, routeDetails] = parts;
        return {
          ...d,
          historyData: {
            msg,
            coin,
            action: action(d, i18nGlobal).toLowerCase(),
            icon: iconFn(d, i18nGlobal).toLowerCase(),
            timestamp: getCreatedAtForHuman(d.timestamp) ?? "",
            ...(route !== undefined ? { route } : {}),
            ...(routeDetails !== undefined ? { routeDetails } : {})
          }
        };
      });

      const res = (await Promise.all(promises)).filter((entry) => entry !== undefined);

      if (refresh) {
        transactions.value = res;
      } else {
        transactions.value = [...transactions.value, ...res];
      }

      // If we got fewer results than requested, all transactions are loaded
      if (rawTxs.length < limit) {
        transactionsLoaded.value = true;
      }

      return res;
    } catch (e) {
      console.error("[HistoryStore] Failed to fetch transactions:", e);
      throw e;
    } finally {
      transactionsLoading.value = false;
    }
  }

  /**
   * Reset transaction pagination state
   */
  function resetTransactions(): void {
    transactions.value = [];
    transactionsLoaded.value = false;
  }

  // ==========================================================================
  // Actions - Activities (ETL History)
  // ==========================================================================

  /**
   * Load historical activities from ETL
   */
  async function loadActivities(): Promise<void> {
    if (!address.value) {
      activities.value = { data: [], loaded: true };
      return;
    }

    const voteMessages: { [key: string]: string } = {
      [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.global.t("message.abstained").toLowerCase(),
      [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.global.t("message.veto").toLowerCase(),
      [VoteOption.VOTE_OPTION_YES]: i18n.global.t("message.yes").toLowerCase(),
      [VoteOption.VOTE_OPTION_NO]: i18n.global.t("message.no").toLowerCase()
    };

    activities.value.loaded = false;

    try {
      const rawTxs = await BackendApi.getTransactions(address.value, 0, 10);
      const transformedTxs = transformTransactions(rawTxs, address.value);
      const currentAddress = address.value ?? "";

      const promises = transformedTxs.map(async (d): Promise<TransactionEntry | undefined> => {
        const parts = await message(d, currentAddress, i18nGlobal, voteMessages);
        if (!isMessageParts(parts)) {
          console.error("[HistoryStore] Skipping activity with unrecognized message shape:", d.tx_hash);
          return undefined;
        }
        const [msg, coin, route, routeDetails] = parts;
        return {
          ...d,
          historyData: {
            msg,
            coin,
            action: action(d, i18nGlobal).toLowerCase(),
            icon: iconFn(d, i18nGlobal).toLowerCase(),
            timestamp: getCreatedAtForHuman(d.timestamp) ?? "",
            ...(route !== undefined ? { route } : {}),
            ...(routeDetails !== undefined ? { routeDetails } : {})
          }
        };
      });

      const res = (await Promise.all(promises)).filter((entry) => entry !== undefined);
      activities.value = { data: res, loaded: true };
    } catch (e) {
      console.warn("[HistoryStore] Failed to load activities:", e);
      activities.value.loaded = true;
    }
  }

  // ==========================================================================
  // Actions - Address Management
  // ==========================================================================

  /**
   * Initialize the store with an address
   */
  async function initialize(newAddress: string): Promise<void> {
    if (initialized.value && address.value === newAddress) {
      return;
    }

    address.value = newAddress;
    initialized.value = true;

    // Load initial activities
    await loadActivities();
  }

  /**
   * Set the wallet address
   */
  function setAddress(newAddress: string | null): void {
    address.value = newAddress;

    if (!newAddress) {
      cleanup();
    }
  }

  /**
   * Clear all state (cleanup on disconnect)
   */
  function cleanup(): void {
    address.value = null;
    initialized.value = false;
    pendingTransfers.value = {};
    activities.value = { data: [], loaded: false };
    transactions.value = [];
    transactionsLoaded.value = false;
  }

  // Self-register: watch wallet address changes from connectionStore.
  // { immediate: true } ensures stores created after wallet is already
  // connected will still load data (the watcher fires with current value).
  useWalletWatcher((addr) => {
    setAddress(addr);
    void loadActivities();
  }, cleanup);

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  function getRouteSteps(
    route: Record<string, unknown>,
    t: (key: string) => string,
    currency: CurrencyInfo | undefined,
    chains: Record<string, unknown>
  ): MediumStep[] {
    const steps: MediumStep[] = [];
    const operations = Array.isArray(route.operations) ? route.operations : [];

    for (const [index, operation] of operations.entries()) {
      // skip, don't throw: pending/historical route data may carry entries this
      // store cannot resolve (e.g. retired protocols); a throw would lose the list
      if (!isRecord(operation)) {
        console.error("[HistoryStore] Skipping malformed route operation at index", index);
        continue;
      }
      const op = isRecord(operation.transfer)
        ? operation.transfer
        : isRecord(operation.cctp_transfer)
          ? operation.cctp_transfer
          : isRecord(operation.swap)
            ? operation.swap
            : undefined;
      if (op === undefined) {
        continue;
      }
      // Skip swap ops carry `chain_id` (+ `from_chain_id`) but no `to_chain_id`;
      // fall back to chain_id so a single-chain swap resolves to an on-chain step.
      const from = getChainDisplay(chains, op.from_chain_id ?? op.chain_id);
      const to = getChainDisplay(chains, op.to_chain_id ?? op.chain_id);
      if (from === undefined || to === undefined) {
        console.error("[HistoryStore] Skipping route step with unknown chain:", op.from_chain_id, op.to_chain_id);
        continue;
      }
      const amount = index === 0 ? operation.amount_in : operation.amount_out;
      if (typeof amount !== "string" && typeof amount !== "number") {
        console.error("[HistoryStore] Skipping route step with malformed amount at index", index);
        continue;
      }
      const label = index > 0 && index < operations.length ? t("message.swap-stepper") : t("message.send-stepper");

      steps.push({
        label,
        icon: from.icon,
        token: {
          balance: formatTokenBalance(new Dec(amount, currency?.decimal_digits)),
          symbol: currency?.shortName ?? ""
        },
        meta: () => h("div", `${from.label} > ${to.label}`)
      });

      if (index === operations.length - 1) {
        const amountOut = operation.amount_out;
        if (typeof amountOut !== "string" && typeof amountOut !== "number") {
          console.error("[HistoryStore] Skipping receive step with malformed amount at index", index);
        } else {
          steps.push({
            label: t("message.receive-stepper"),
            icon: to.icon,
            token: {
              balance: formatTokenBalance(new Dec(amountOut, currency?.decimal_digits)),
              symbol: currency?.shortName ?? ""
            },
            meta: () => h("div", `${to.label}`)
          });
        }
      }
    }

    return steps;
  }

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    pendingTransfers,
    activities,
    transactions,
    transactionsLoading,
    transactionsLoaded,
    address,
    initialized,

    // Computed
    pendingTransfersList,
    hasPendingTransfers,
    activitiesLoaded,
    allTransactionsLoaded,

    // Actions - Pending Transfers
    addPendingTransfer,
    getPendingTransfer,
    updatePendingTransferStatus,
    incrementPendingTransferStep,
    completePendingTransfer,
    failPendingTransfer,
    setTransferTxHashes,
    removePendingTransfer,
    clearPendingTransfers,

    // Actions - Transactions
    fetchTransactions,
    resetTransactions,

    // Actions - Activities
    loadActivities,

    // Actions - Lifecycle
    initialize,
    setAddress,
    cleanup
  };
});
