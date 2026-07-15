import { computed, inject, watch, type ComputedRef } from "vue";
import { ToastType } from "web-components";
import { RouteNames } from "@/router";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { classifyError, getMicroAmount, Logger, walletOperation } from "@/common/utils";
import { formatDecAsUsd, formatUsd } from "@/common/utils/NumberFormatUtils";
import { INTEREST_DECIMALS, WASM_EVENTS } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { useI18n } from "vue-i18n";
import type { NolusWallet } from "@nolus/nolusjs";
import { NolusClient } from "@nolus/nolusjs";
import { Leaser } from "@nolus/nolusjs/build/contracts";
import { useRouter } from "vue-router";
import type { LeaseOpenApi } from "./useLeaseOpen";

// The down-payment asset option produced by each form's `assets` computed.
// `useLeaseForm` reads only `key` and `balance.denom`; the remaining display
// fields exist so the same object satisfies the AdvancedFormControl bindings.
export interface LeaseAssetBalance {
  value: string;
  customLabel: string;
  ticker: string;
  denom: string | undefined;
  amount: string | undefined;
}

export interface LeaseAssetOption {
  name: string;
  value: string;
  label: string;
  shortName: string;
  icon: string;
  decimal_digits: number;
  balance: LeaseAssetBalance;
  ibcData: string | undefined;
  native: boolean;
  symbol: string;
  ticker: string;
  key: string;
  stable: Dec;
  price: string;
}

// The loan (asset-to-lease) option. Long carries `decimal_digits`, Short carries
// `protocol`; the shared core only ever reads `key`.
export interface LeaseLoanOption {
  key: string;
  ticker: string;
  label: string;
  value: string;
  icon: string;
  decimal_digits?: number;
  protocol?: string;
}

// The leaseQuote / open-lease arguments. Their derivation is the Long-vs-Short
// asymmetry (see the Short-protocol notes in the project CLAUDE.md), so each
// form provides it via `resolveQuoteParams` rather than sharing a merged branch.
export interface LeaseQuoteParams {
  downPaymentTicker: string;
  leaseTicker: string;
  protocol: string;
}

// The per-position pieces the shared form logic needs. Everything divergent —
// the collateral list, the loan list, and the ticker/protocol resolution —
// lives behind this so the reactive validation, quote, and submit flows stay
// identical across both forms.
export interface LeaseFormStrategy {
  currency: ComputedRef<LeaseAssetOption | undefined>;
  coinList: ComputedRef<LeaseLoanOption[]>;
  resolveQuoteParams: (downPayment: LeaseAssetOption, loan: LeaseLoanOption) => Promise<LeaseQuoteParams>;
  logLabel: string;
}

export function useLeaseForm(base: LeaseOpenApi, strategy: LeaseFormStrategy) {
  const { currency, coinList, resolveQuoteParams, logLabel } = strategy;

  const walletStore = useWalletStore();
  const balancesStore = useBalancesStore();
  const configStore = useConfigStore();
  const pricesStore = usePricesStore();
  const historyStore = useHistoryStore();
  const i18n = useI18n();
  const router = useRouter();

  const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});
  const reload = inject("reload", () => {});

  watch(
    () => configStore.initialized,
    () => {
      if (configStore.initialized) {
        void onInit();
      }
    },
    {
      immediate: true
    }
  );

  async function onInit() {
    // Free interest is handled by a 3rd party service
    // Asset filtering (ignore_long/ignore_short) is done by the backend in /api/protocols/{protocol}/currencies
  }

  // Reactive balance validation MUST run first and short-circuit the quote: a
  // zero-balance collateral has no denom, so a quote attempt throws and the
  // catch surfaces a generic error instead of "Insufficient balance" (#192).
  watch(
    () => [base.selectedCurrency.value, base.amount.value, base.selectedLoanCurrency.value, base.ltd.value],
    async () => {
      base.amountErrorMsg.value = "";
      if (!base.validateAmountAgainstBalance(currency.value)) {
        base.leaseApply.value = null;
        return;
      }
      if (await base.validateMinMaxValues(currency.value, coinList.value[base.selectedLoanCurrency.value])) {
        void calculate();
      } else {
        base.leaseApply.value = null;
      }
    }
  );

  const selectedLoanOption = computed(() => {
    return coinList.value[base.selectedLoanCurrency.value];
  });

  const advancedControlBindings = computed(() => {
    return {
      ...(base.errorInsufficientBalance.value ? { inputClass: "text-typography-error" } : {}),
      ...(currency.value !== undefined ? { selectedCurrencyOption: currency.value } : {})
    };
  });

  const calculatedBalance = computed(() => {
    const asset = currency.value;
    if (!asset) {
      return formatUsd(0);
    }
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
    const v = base.amount?.value?.length ? base.amount?.value : "0";
    const stable = price.mul(new Dec(v));
    return formatDecAsUsd(stable);
  });

  async function calculate() {
    try {
      const selectedDownPaymentCurrency = currency.value;
      const selectedLoan = coinList.value[base.selectedLoanCurrency.value];
      const downPayment = base.amount.value;

      if (downPayment) {
        if (selectedDownPaymentCurrency === undefined || selectedLoan === undefined) {
          throw new Error("down payment or lease currency is not selected");
        }
        const denom = selectedDownPaymentCurrency.balance.denom;
        if (denom === undefined) {
          throw new Error(`missing bank denom for ${selectedDownPaymentCurrency.key}`);
        }
        const microAmount = getMicroAmount(denom, downPayment);

        const { downPaymentTicker, leaseTicker, protocol } = await resolveQuoteParams(
          selectedDownPaymentCurrency,
          selectedLoan
        );

        const contracts = configStore.contracts[protocol];
        if (contracts === undefined || contracts.leaser === null) {
          throw new Error(`no leaser contract configured for protocol ${protocol}`);
        }

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaserClient = new Leaser(cosmWasmClient, contracts.leaser);

        const makeLeaseApplyResp = await leaserClient.leaseQuote(
          microAmount.mAmount.amount.toString(),
          downPaymentTicker,
          leaseTicker,
          base.ltd.value
        );

        makeLeaseApplyResp.annual_interest_rate =
          makeLeaseApplyResp.annual_interest_rate / Math.pow(10, INTEREST_DECIMALS);
        makeLeaseApplyResp.annual_interest_rate_margin =
          makeLeaseApplyResp.annual_interest_rate_margin / Math.pow(10, INTEREST_DECIMALS);

        base.leaseApply.value = makeLeaseApplyResp;
      } else {
        base.leaseApply.value = null;
      }
    } catch (error) {
      Logger.error(`${logLabel} calculate error:`, error);
      base.amountErrorMsg.value = i18n.t(classifyError(error));
      base.leaseApply.value = null;
    }
  }

  async function onOpenLease() {
    try {
      base.isDisabled.value = true;
      await walletOperation(openLease);
    } catch (error: unknown) {
      base.amountErrorMsg.value = i18n.t(classifyError(error));
      Logger.error(error);
    } finally {
      base.isDisabled.value = false;
    }
  }

  async function openLease() {
    const wallet = walletStore.wallet as NolusWallet;
    if (
      wallet &&
      (await base.isDownPaymentAmountValid(currency.value, coinList.value[base.selectedLoanCurrency.value]))
    ) {
      try {
        base.isLoading.value = true;

        const selectedDownPaymentCurrency = currency.value;
        const downPayment = base.amount.value;
        const selectedLoan = coinList.value[base.selectedLoanCurrency.value];

        if (selectedDownPaymentCurrency === undefined || selectedLoan === undefined) {
          throw new Error("down payment or lease currency is not selected");
        }
        const denom = selectedDownPaymentCurrency.balance.denom;
        if (denom === undefined) {
          throw new Error(`missing bank denom for ${selectedDownPaymentCurrency.key}`);
        }
        const microAmount = getMicroAmount(denom, downPayment);

        const funds = [
          {
            denom: microAmount.coinMinimalDenom,
            amount: microAmount.mAmount.amount.toString()
          }
        ];

        const { leaseTicker, protocol } = await resolveQuoteParams(selectedDownPaymentCurrency, selectedLoan);

        const contracts = configStore.contracts[protocol];
        if (contracts === undefined || contracts.leaser === null) {
          throw new Error(`no leaser contract configured for protocol ${protocol}`);
        }

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaserClient = new Leaser(cosmWasmClient, contracts.leaser);

        const { txBytes } = await leaserClient.simulateOpenLeaseTx(wallet, leaseTicker, base.ltd.value, funds);

        const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);

        const item = tx?.events.find((event) => {
          return event.type === WASM_EVENTS["wasm-ls-request-loan"].key;
        });

        const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];
        void balancesStore.fetchBalances();
        void historyStore.loadActivities();
        reload();
        onShowToast({
          type: ToastType.success,
          message: i18n.t("message.currently-opening")
        });

        if (data === undefined) {
          throw new Error("wasm-ls-request-loan event attribute missing from the broadcast result");
        }
        void router.push(`/${RouteNames.LEASES}/${data.value}`);
      } catch (error: unknown) {
        base.amountErrorMsg.value = i18n.t(classifyError(error));
        Logger.error(error);
      } finally {
        base.isLoading.value = false;
      }
    }
  }

  return {
    selectedLoanOption,
    advancedControlBindings,
    calculatedBalance,
    onOpenLease
  };
}
