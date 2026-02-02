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
import { getCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { EtlApi, getCreatedAtForHuman, StringUtils } from "@/common/utils";
import { action, icon as iconFn, message } from "@/modules/history/common";
import { i18n } from "@/i18n";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";

export const useHistoryStore = defineStore("history", () => {
  // ==========================================================================
  // State
  // ==========================================================================
  
  /** Pending transfers indexed by ID */
  const pendingTransfers = ref<{ [key: string]: IObjectKeys }>({});
  
  /** Historical activities from ETL */
  const activities = ref<{ data: IObjectKeys[]; loaded: boolean }>({ data: [], loaded: false });
  
  /** Current wallet address */
  const address = ref<string | null>(null);

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

  // ==========================================================================
  // Actions - Pending Transfers
  // ==========================================================================

  /**
   * Add or update a pending transfer
   * Called when initiating a send/receive operation
   */
  function addPendingTransfer(historyData: IObjectKeys, i18nInstance: IObjectKeys): void {
    const currency = getCurrencyByDenom(historyData.currency);

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
  // Actions - Activities (ETL History)
  // ==========================================================================

  /**
   * Load historical activities from ETL
   */
  async function loadActivities(): Promise<void> {
    try {
      if (address.value) {
        const voteMessages: { [key: string]: string } = {
          [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.global.t("message.abstained").toLowerCase(),
          [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.global.t("message.veto").toLowerCase(),
          [VoteOption.VOTE_OPTION_YES]: i18n.global.t("message.yes").toLowerCase(),
          [VoteOption.VOTE_OPTION_NO]: i18n.global.t("message.no").toLowerCase()
        };

        activities.value.loaded = false;

        const res = await EtlApi.fetchTXS(address.value, 0, 10).then((data) => {
          const promises = [];
          for (const d of data) {
            const fn = async () => {
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
            };
            promises.push(fn());
          }
          return Promise.all(promises);
        });

        activities.value = { data: res, loaded: true };
      } else {
        activities.value = { data: [], loaded: true };
      }
    } catch (e: Error | any) {
      console.warn("[HistoryStore] Failed to load activities:", e);
      activities.value.loaded = true;
    }
  }

  // ==========================================================================
  // Actions - Address Management
  // ==========================================================================

  /**
   * Set the wallet address
   */
  function setAddress(newAddress: string | null): void {
    address.value = newAddress;
    
    if (!newAddress) {
      clearPendingTransfers();
      activities.value = { data: [], loaded: false };
    }
  }

  /**
   * Clear all state (on disconnect)
   */
  function clear(): void {
    address.value = null;
    pendingTransfers.value = {};
    activities.value = { data: [], loaded: false };
  }

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
    address,

    // Computed
    pendingTransfersList,
    hasPendingTransfers,
    activitiesLoaded,

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

    // Actions - Activities
    loadActivities,

    // Actions - Address
    setAddress,
    clear,
  };
});
