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
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import { useConfigStore } from "@/common/stores/config";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { BackendApi } from "@/common/api";
import { getCreatedAtForHuman, StringUtils } from "@/common/utils";
import { action, icon as iconFn, message } from "@/modules/history/common";
import { i18n } from "@/i18n";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";
import type { TxEntry, TransactionFilters } from "@/common/api/types";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { Registry } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { Any } from "cosmjs-types/google/protobuf/any";
import { Buffer } from "buffer";

// Registry for decoding transaction messages
const registry = new Registry(defaultRegistryTypes);
registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);

export const useHistoryStore = defineStore("history", () => {
  // ==========================================================================
  // State
  // ==========================================================================
  
  /** Pending transfers indexed by ID */
  const pendingTransfers = ref<{ [key: string]: IObjectKeys }>({});
  
  /** Historical activities from ETL */
  const activities = ref<{ data: IObjectKeys[]; loaded: boolean }>({ data: [], loaded: false });
  
  /** Full transaction history (paginated) */
  const transactions = ref<IObjectKeys[]>([]);
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
  const pendingTransfersList = computed(() => {
    const items = [];
    for (const key in pendingTransfers.value) {
      items.push(pendingTransfers.value[key]);
    }
    return items.sort((a, b) => b.historyData.id - a.historyData.id);
  });

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
  function addPendingTransfer(historyData: IObjectKeys, i18nInstance: IObjectKeys): void {
    const configStore = useConfigStore();
    const currency = configStore.getCurrencyByDenom(historyData.currency);

    switch (historyData.type) {
      case HYSTORY_ACTIONS.RECEIVE: {
        const token = CurrencyUtils.convertMinimalDenomToDenom(
          historyData.skipRoute.amountOut,
          currency?.ibcData!,
          currency?.shortName!,
          Number(currency?.decimal_digits)
        );
        historyData.msg = i18nInstance.t("message.receive-action", {
          amount: token.toString(),
          address: StringUtils.truncateString(historyData.fromAddress, 6, 6)
        });
        historyData.coin = token;
        break;
      }
      case HYSTORY_ACTIONS.SEND: {
        const token = CurrencyUtils.convertMinimalDenomToDenom(
          historyData.skipRoute.amountIn,
          currency?.ibcData!,
          currency?.shortName!,
          Number(currency?.decimal_digits)
        );
        historyData.msg = i18nInstance.t("message.send-action", {
          amount: token.toString(),
          address: StringUtils.truncateString(historyData.receiverAddress, 6, 6)
        });
        historyData.coin = token;
        break;
      }
    }

    historyData.action = i18nInstance.t("message.transfer-history");
    historyData.icon = "assets";
    historyData.routeDetails = {
      steps: getRouteSteps(historyData.skipRoute, i18nInstance, currency, historyData.chains),
      activeStep: 0
    };
    historyData.route = {
      steps: getRouteSteps(historyData.skipRoute, i18nInstance, currency, historyData.chains),
      activeStep: 0
    };
    historyData.status = CONFIRM_STEP.PENDING;

    pendingTransfers.value[historyData.id] = {
      historyData
    };
  }

  /**
   * Get a pending transfer by ID
   */
  function getPendingTransfer(id: string): IObjectKeys | undefined {
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
    if (pendingTransfers.value[id]) {
      pendingTransfers.value[id].historyData.route.activeStep++;
      pendingTransfers.value[id].historyData.routeDetails.activeStep++;
    }
  }

  /**
   * Mark a pending transfer as complete
   */
  function completePendingTransfer(id: string): void {
    if (pendingTransfers.value[id]) {
      const transfer = pendingTransfers.value[id];
      transfer.historyData.route.activeStep = transfer.historyData.route.steps.length;
      transfer.historyData.routeDetails.activeStep = transfer.historyData.routeDetails.steps.length;
      transfer.historyData.status = CONFIRM_STEP.SUCCESS;
    }
  }

  /**
   * Mark a pending transfer as failed
   */
  function failPendingTransfer(id: string, errorMsg: string): void {
    if (pendingTransfers.value[id]) {
      const transfer = pendingTransfers.value[id];
      transfer.historyData.errorMsg = errorMsg;
      
      // Mark current step as failed
      const activeStep = transfer.historyData.route.activeStep;
      if (transfer.historyData.route.steps[activeStep]) {
        transfer.historyData.route.steps[activeStep].status = "failed";
      }
      if (transfer.historyData.routeDetails.steps[activeStep]) {
        transfer.historyData.routeDetails.steps[activeStep].status = "failed";
      }
      
      transfer.historyData.status = CONFIRM_STEP.ERROR;
    }
  }

  /**
   * Set transaction hashes for a pending transfer
   */
  function setTransferTxHashes(id: string, txHashes: string[]): void {
    if (pendingTransfers.value[id]) {
      pendingTransfers.value[id].historyData.txHashes = txHashes;
    }
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
  function transformTransactions(rawTxs: TxEntry[], walletAddress: string): IObjectKeys[] {
    return rawTxs.map((item) => {
      return {
        ...item,
        timestamp: new Date(item.timestamp),
        type: item.tx_type
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
  ): Promise<IObjectKeys[]> {
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
      const response = await BackendApi.getTransactions(address.value, skip, limit, filters);
      const transformedTxs = transformTransactions(response.data, address.value);
      
      // Process each transaction with message formatting
      const promises = transformedTxs.map(async (d) => {
        const [msg, coin, route, routeDetails] = await message(d, address.value!, i18n.global, voteMessages);
        d.historyData = {
          msg,
          coin,
          action: action(d, i18n.global).toLowerCase(),
          icon: iconFn(d, i18n.global).toLowerCase(),
          timestamp: getCreatedAtForHuman(d.timestamp),
          route,
          routeDetails
        };
        return d;
      });

      const res = await Promise.all(promises);

      if (refresh) {
        transactions.value = res;
      } else {
        transactions.value = [...transactions.value, ...res];
      }

      // Check if we've loaded all transactions based on total count
      if (transactions.value.length >= response.total) {
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

      const promises = transformedTxs.map(async (d) => {
        const [msg, coin, route, routeDetails] = await message(d, address.value!, i18n.global, voteMessages);
        d.historyData = {
          msg,
          coin,
          action: action(d, i18n.global).toLowerCase(),
          icon: iconFn(d, i18n.global).toLowerCase(),
          timestamp: getCreatedAtForHuman(d.timestamp),
          route,
          routeDetails
        };
        return d;
      });

      const res = await Promise.all(promises);
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

  // Alias for backwards compatibility
  const clear = cleanup;

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  function getRouteSteps(
    route: IObjectKeys,
    i18nInstance: IObjectKeys,
    currency: IObjectKeys,
    chains: IObjectKeys[]
  ) {
    const steps = [];
    for (const [index, operation] of (route?.operations ?? []).entries()) {
      if (operation.transfer || operation.cctp_transfer) {
        const op = operation.transfer ?? operation.cctp_transfer;
        const from = chains[op.from_chain_id];
        const to = chains[op.to_chain_id];
        let label = i18nInstance.t("message.send-stepper");

        if (index > 0 && index < route?.operations.length) {
          label = i18nInstance.t("message.swap-stepper");
        }

        steps.push({
          label,
          icon: from.icon,
          token: {
            balance: formatNumber(
              new Dec(index == 0 ? operation.amount_in : operation.amount_out, currency?.decimal_digits).toString(
                currency?.decimal_digits
              ),
              currency?.decimal_digits
            ),
            symbol: currency?.shortName
          },
          meta: () => h("div", `${from.label} > ${to.label}`)
        });

        if (index == route?.operations.length - 1) {
          steps.push({
            label: i18nInstance.t("message.receive-stepper"),
            icon: to.icon,
            token: {
              balance: formatNumber(
                new Dec(operation.amount_out, currency?.decimal_digits).toString(currency?.decimal_digits),
                currency?.decimal_digits
              ),
              symbol: currency?.shortName
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
    cleanup,
    clear, // Alias for backwards compatibility
  };
});
