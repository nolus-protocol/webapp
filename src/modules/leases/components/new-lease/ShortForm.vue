<template>
  <div
    class="flex w-full flex-1 flex-col self-start rounded-xl border border-border-default bg-neutral-bg-2 shadow-larger"
  >
    <div class="flex rounded-tl-xl rounded-tr-xl border-b border-border-color bg-neutral-bg-1">
      <Radio
        v-for="(tab, index) in tabs"
        :key="index"
        :id="`tab-${index}`"
        ref="radioRefs"
        :class="[{ 'bg-neutral-bg-2': activeTabIdx === index, 'rounded-tl-xl': index === 0 }]"
        :label="$t(`message.${tab.action}`)"
        :checked="activeTabIdx == index"
        class="flex cursor-pointer justify-center border-r border-border-color bg-neutral-bg-1 px-6 py-5 text-16 font-normal text-typography-default"
        name="dialogTabsGroup"
        @click="handleParentClick(index)"
      />
    </div>

    <AdvancedFormControl
      searchable
      id="receive-send"
      :currencyOptions="assets"
      class="px-6 pt-4"
      :label="$t('message.down-payment-uppercase')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :disabled-currency-picker="isLoading"
      :disabled-input-field="isLoading"
      @on-selected-currency="
        (option) => {
          selectedCurrency = assets.findIndex((item) => item == option);
          selectedLoanCurrency = 0;
        }
      "
      @input="handleAmountChange"
      :error-msg="amountErrorMsg"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :item-template="
        (item: any) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value,
            max_decimals: item.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : item.decimal_digits
          })
      "
      :selected-currency-option="currency"
    />
    <hr class="my-4 border-border-color" />
    <div class="flex max-w-[190px] flex-col gap-2 px-6">
      <label
        for="dropdown-btn-asset-to-lease"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.asset-to-lease") }}</label
      >
      <Dropdown
        id="asset-to-lease"
        :on-select="
          (data) => {
            selectedLoanCurrency = coinList.findIndex((item) => item == data);
          }
        "
        :options="coinList"
        :size="Size.medium"
        :selected="coinList[selectedLoanCurrency]"
        searchable
        :disabled="isLoading"
      />
    </div>
    <hr class="my-4 border-border-color" />
    <div class="flex flex-col gap-2 px-6">
      <label
        for="position-size"
        class="flex w-fit items-center text-16 font-semibold text-typography-default"
        >{{ $t("message.position-size") }}
        <Tooltip
          position="top"
          :content="$t('message.lease-swap-fee-tooltip')"
        >
          <SvgIcon
            name="help"
            class="rounded-full"
            size="s"
          />
        </Tooltip>
      </label>
      <div class="px-[18px] py-3">
        <Slider
          :disabled="isLoading"
          :min-position="MIN_POSITION"
          :max-position="MAX_POSITION"
          :positions="POSITIONS"
          @on-drag="onDrag"
          class="relative"
        />
      </div>
    </div>
    <hr class="my-4 border-border-color" />
    <div class="flex justify-end px-4">
      <Button
        :label="$t('message.show-transaction-details')"
        severity="tertiary"
        icon="plus"
        iconPosition="left"
        size="small"
        class="text-icon-default"
      />
    </div>
    <hr class="my-4 border-border-color" />
    <div class="flex flex-col gap-2 p-6">
      <Button
        size="large"
        severity="primary"
        :label="$t('message.open-position')"
        @click="onOpenLease()"
        :loading="isLoading"
        :disabled="isDisabled"
      />
      <p class="text-center text-12 text-typography-secondary">
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.longOperationsEstimation }}{{ $t("message.sec") }}
      </p>
    </div>
  </div>
  <ShortLeaseDetails
    :downpaymen-amount="amount"
    :downpayment-currency="currency.key"
    :lease="leaseApply"
    :loan-currency="coinList[selectedLoanCurrency].key"
  />
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, watch } from "vue";
import {
  AdvancedFormControl,
  Button,
  Dropdown,
  Radio,
  Size,
  Slider,
  type AssetItemProps,
  AssetItem,
  Tooltip,
  SvgIcon,
  ToastType
} from "web-components";
import { RouteNames } from "@/router";
import { tabs } from "../types";

import ShortLeaseDetails from "@/modules/leases/components/new-lease/ShortLeaseDetails.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { AppUtils, AssetUtils, getMicroAmount, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency, IObjectKeys } from "@/common/types";
import {
  INTEREST_DECIMALS,
  MAX_DECIMALS,
  MAX_POSITION,
  MIN_POSITION,
  PERCENT,
  PERMILLE,
  POSITIONS,
  PositionTypes,
  ProtocolsConfig,
  WASM_EVENTS
} from "@/config/global";
import { CurrencyMapping } from "@/config/currencies";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { Dec, Int } from "@keplr-wallet/unit";
import { h } from "vue";
import { useI18n } from "vue-i18n";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { useAdminStore } from "@/common/stores/admin";
import { Leaser, type LeaseApply } from "@nolus/nolusjs/build/contracts";
import { useRouter } from "vue-router";

const activeTabIdx = 1;
const walletStore = useWalletStore();
const app = useApplicationStore();
const oracle = useOracleStore();
const i18n = useI18n();
const router = useRouter();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const reload = inject("reload", () => {});

const freeInterest = ref<string[]>();
const selectedCurrency = ref(0);
const selectedLoanCurrency = ref(0);
const isLoading = ref(false);
const isDisabled = ref(false);

const amount = ref("");
const amountErrorMsg = ref("");
const ltd = ref((MAX_POSITION / PERCENT) * PERMILLE);
const leaseApply = ref<LeaseApply | null>();

onMounted(async () => {
  const [freeInterestv] = await Promise.all([AppUtils.getFreeInterest()]);
  freeInterest.value = freeInterestv;
});

watch(
  () => [selectedCurrency.value, amount.value, selectedLoanCurrency.value, ltd.value],
  async () => {
    amountErrorMsg.value = "";
    if (await validateMinMaxValues()) {
      calculate();
    } else {
      leaseApply.value = null;
    }
  }
);

const totalBalances = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol in ProtocolsConfig) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      for (const c of ProtocolsConfig[protocol].currencies) {
        const item = app.currenciesData?.[`${c}@${protocol}`];
        let balance = walletStore.balances.find((c) => c.balance.denom == item?.ibcData);
        if (currencies.findIndex((item) => item.balance.denom == balance?.balance.denom) == -1) {
          currencies.push({ ...item, balance: balance?.balance } as ExternalCurrency);
        }
      }
    }
  }

  return currencies;
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const assets = computed(() => {
  const data = [];
  for (const asset of (totalBalances.value as ExternalCurrency[]) ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = AssetUtils.formatNumber(value.toString(), asset.decimal_digits);
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const price = new Dec(oracle.prices?.[asset.key]?.amount ?? 0);
    const stable = price.mul(value);

    data.push({
      name: asset.name,
      value: denom,
      label: asset.shortName!,
      shortName: asset.shortName!,
      icon: asset.icon!,
      decimal_digits: asset.decimal_digits!,
      balance: {
        value: balance,
        ticker: asset.shortName!,
        denom: asset.balance.denom,
        amount: asset.balance?.amount
      },
      ibcData: (asset as ExternalCurrency).ibcData,
      native: asset.native!,
      sybmol: asset.symbol!,
      ticker: asset.ticker!,
      key: asset.key,
      stable,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }
  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const coinList = computed(() => {
  let currencies: ExternalCurrency[] = [];

  for (const protocol of app.protocols) {
    if (ProtocolsConfig[protocol].type == PositionTypes.short) {
      const c =
        app.lpn?.filter((item) => {
          const [_, p] = item.key.split("@");
          if (p == protocol) {
            return true;
          }
          return false;
        }) ?? [];
      currencies = [...currencies, ...c];
    }
  }

  return currencies.map((item) => ({
    key: item.key,
    ticker: item.ticker,
    label: item.shortName as string,
    value: item.ibcData,
    icon: item.icon as string
  }));
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
  }

  const price = new Dec(oracle.prices?.[asset.key!]?.amount ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

function handleAmountChange(event: string) {
  amount.value = event;
}

const handleParentClick = (index: number) => {
  const tab = tabs[index];
  router.push({ path: `/${RouteNames.LEASES}/open/${tab.action}` });
};

function onDrag(event: number) {
  const pos = new Dec(event / PERCENT);
  ltd.value = Number(pos.mul(new Dec(PERMILLE)).truncate().toString());
}

async function validateMinMaxValues(): Promise<boolean> {
  try {
    let isValid = true;
    const selectedDownPaymentCurrency = currency.value;
    const selectedCurrency = coinList.value[selectedLoanCurrency.value];

    const downPaymentAmount = amount.value;
    const currentBalance = selectedDownPaymentCurrency;

    const [c, p] = selectedCurrency.key.split("@");
    const range = (await AppUtils.getDownpaymentRange(p))[c];

    if (currentBalance) {
      if (downPaymentAmount || downPaymentAmount !== "") {
        const price = oracle.prices[selectedDownPaymentCurrency.key as string];

        const max = new Dec(range?.max ?? 0);
        const min = new Dec(range?.min ?? 0);

        const leaseMax = max.quo(new Dec(price.amount));
        const leaseMin = min.quo(new Dec(price.amount));

        const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
          downPaymentAmount,
          currentBalance.ibcData,
          currentBalance.decimal_digits
        );
        const balance = CurrencyUtils.calculateBalance(
          price.amount,
          downPaymentAmountInMinimalDenom,
          currentBalance.decimal_digits
        ).toDec();

        if (balance.lt(min)) {
          amountErrorMsg.value = i18n.t("message.lease-min-error", {
            minAmount: leaseMin.toString(selectedDownPaymentCurrency.decimal_digits),
            maxAmount: leaseMax.toString(selectedDownPaymentCurrency.decimal_digits),
            symbol: selectedDownPaymentCurrency.shortName
          });
          isValid = false;
        }

        if (balance.gt(max)) {
          amountErrorMsg.value = i18n.t("message.lease-max-error", {
            minAmount: leaseMin.toString(selectedDownPaymentCurrency.decimal_digits),
            maxAmount: leaseMax.toString(selectedDownPaymentCurrency.decimal_digits),
            symbol: selectedDownPaymentCurrency.shortName
          });
          isValid = false;
        }
      }
    }

    return isValid;
  } catch (error) {
    amountErrorMsg.value = i18n.t("message.integer-out-of-range");
    return false;
  }
}

function isDownPaymentAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";

  const selectedDownPaymentCurrency = currency.value;
  const downPaymentAmount = amount.value;

  if (downPaymentAmount || downPaymentAmount !== "") {
    const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      downPaymentAmount,
      "",
      selectedDownPaymentCurrency.decimal_digits
    );

    const isLowerThanOrEqualsToZero = new Dec(downPaymentAmountInMinimalDenom.amount || "0").lte(new Dec(0));

    const isGreaterThanWalletBalance = new Int(downPaymentAmountInMinimalDenom.amount.toString() || "0").gt(
      selectedDownPaymentCurrency?.balance?.amount
    );

    if (isLowerThanOrEqualsToZero) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-low");
      isValid = false;
    }

    if (isGreaterThanWalletBalance) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-big");
      isValid = false;
    }

    if (!validateMinMaxValues()) {
      isValid = false;
    }
  } else {
    amountErrorMsg.value = i18n.t("message.missing-amount");
    isValid = false;
  }

  return isValid;
}

async function calculate() {
  try {
    const downPaymentAmount = amount.value;
    const selectedDownPaymentCurrency = currency.value;
    const loanCurrency = coinList.value[selectedLoanCurrency.value];
    if (downPaymentAmount) {
      const microAmount = getMicroAmount(selectedDownPaymentCurrency.balance.denom, downPaymentAmount);

      const currency = selectedDownPaymentCurrency;
      const [_c, protocol] = loanCurrency.key.split("@");

      let [downPaymentTicker, _p] = currency.key.split("@");

      if (
        CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping] &&
        (protocol == AppUtils.getProtocols().osmosis || protocol == AppUtils.getProtocols().osmosis_noble)
      ) {
        downPaymentTicker = CurrencyMapping[downPaymentTicker as keyof typeof CurrencyMapping]?.ticker;
      }

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);

      const makeLeaseApplyResp = await leaserClient.leaseQuote(
        microAmount.mAmount.amount.toString(),
        downPaymentTicker,
        app.lease?.[protocol][0] as string,
        ltd.value
      );

      makeLeaseApplyResp.annual_interest_rate =
        makeLeaseApplyResp.annual_interest_rate / Math.pow(10, INTEREST_DECIMALS);
      makeLeaseApplyResp.annual_interest_rate_margin =
        makeLeaseApplyResp.annual_interest_rate_margin / Math.pow(10, INTEREST_DECIMALS);

      leaseApply.value = makeLeaseApplyResp;
    } else {
      leaseApply.value = null;
    }
  } catch (error) {
    amountErrorMsg.value = i18n.t("message.no-liquidity");
    leaseApply.value = null;
  }
}

async function onOpenLease() {
  try {
    isDisabled.value = true;
    await walletOperation(openLease);
  } catch (error: Error | any) {
    amountErrorMsg.value = error.toString();
    Logger.error(error);
  } finally {
    isDisabled.value = false;
  }
}

async function openLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isDownPaymentAmountValid()) {
    try {
      isLoading.value = true;

      const selectedDownPaymentCurrency = currency.value;
      const downPayment = amount.value;
      const selectedCurrency = coinList.value[selectedLoanCurrency.value];

      const microAmount = getMicroAmount(selectedDownPaymentCurrency.balance.denom, downPayment);

      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();

      let [_, protocol] = selectedCurrency.key.split("@");

      const leaserClient = new Leaser(cosmWasmClient, admin.contracts![protocol].leaser);

      const { txHash, txBytes, usedFee } = await leaserClient.simulateOpenLeaseTx(
        wallet,
        app.lease?.[protocol][0] as string,
        ltd.value,
        funds
      );

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);

      const item = tx?.events.find((item: IObjectKeys) => {
        return item.type == WASM_EVENTS["wasm-ls-request-loan"].key;
      });

      const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];
      walletStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.currently-opening")
      });

      router.push(`/${RouteNames.LEASES}/${protocol.toLowerCase()}/${data.value}`);
    } catch (error: Error | any) {
      amountErrorMsg.value = error.toString();
      Logger.error(error);
    } finally {
      isLoading.value = false;
    }
  }
}
</script>
