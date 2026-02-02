<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.repay`)"
    showClose
    :disable-close="false"
    @close-dialog="
      () => {
        const path =
          route.matched[2].path == `/${RouteNames.LEASES}`
            ? `/${RouteNames.LEASES}`
            : `/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}`;
        router.push(path);
      }
    "
  >
    <template v-slot:content>
      <div
        id="dialog-scroll"
        class="custom-scroll max-h-full flex-1 overflow-auto"
      >
        <hr class="border-border-color" />
        <div class="flex flex-col gap-4 px-2 py-4">
          <AdvancedFormControl
            searchable
            id="receive-send"
            :currencyOptions="assets"
            class="px-6 pt-4"
            :label="$t('message.amount-to-repay')"
            :balanceLabel="$t('message.balance')"
            placeholder="0"
            :calculated-balance="calculatedBalance"
            :disabled-currency-picker="isLoading"
            :disabled-input-field="isLoading"
            @on-selected-currency="
              (option) => {
                selectedCurrency = assets.findIndex((item) => item == option);
              }
            "
            :value-only="amount"
            @input="handleAmountChange"
            :error-msg="amountErrorMsg"
            :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
            :item-template="
              (item: any) =>
                h<AssetItemProps>(AssetItem, {
                  ...item,
                  abbreviation: item.label,
                  name: item.name,
                  balance: item.balance.value
                })
            "
            :selected-currency-option="currency"
          />
          <div class="px-6 py-3">
            <!-- :label-right="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`" -->
            <Slider
              :min-position="0"
              :max-position="100"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-right="`${$t('message.debt')}`"
              @click-right-label="() => onSetAmount(100)"
              @click-left-label="() => onSetAmount(0)"
            />
          </div>
        </div>
        <hr class="border-border-color" />
        <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
          <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
          <template v-if="sliderValue == 0">
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="list-sparkle"
                class="fill-icon-secondary"
              />
              {{ $t("message.preview-input") }}
            </div>
          </template>
          <template v-if="sliderValue > 0 && sliderValue < 100">
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="fill-icon-success"
              />
              <p :innerHTML="$t('message.debt-pay-off', { data: detbPartial.payment })"></p>
            </div>
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="fill-icon-success"
              />
              <p :innerHTML="$t('message.repay-liquidation-price', { data: liquidation })"></p>
            </div>
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="info"
                class="fill-icon-secondary"
              />
              {{ $t("message.outstanding-debt-rest") }}
              {{ detbPartial.rest }}
            </div>
          </template>
          <template v-if="sliderValue >= 100">
            <div class="flex items-center gap-2 text-14">
              <SvgIcon
                name="check-solid"
                class="fill-icon-success"
              />
              {{ $t("message.debt-paid") }}
              <strong>{{ debtData }}</strong>
            </div>
          </template>
        </div>
        <hr class="border-border-color" />
      </div>
      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.repay`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseRepayEstimation }}{{ $t("message.sec") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AdvancedFormControl,
  Button,
  Dialog,
  AssetItem,
  Slider,
  SvgIcon,
  type AssetItemProps,
  ToastType
} from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { getMicroAmount, LeaseUtils, Logger, walletOperation } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { minimumLeaseAmount, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { h } from "vue";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";
import type { LeaseInfo } from "@/common/api";

const timeOut = 250;
let time: NodeJS.Timeout;

const route = useRoute();
const router = useRouter();
const pricesStore = usePricesStore();
const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const configStore = useConfigStore();
const leasesStore = useLeasesStore();
const i18n = useI18n();

const amount = ref("");
const amountErrorMsg = ref("");
const selectedCurrency = ref(0);
const ignoreDownpaymentAssets = ref<string[]>();
const isLoading = ref(false);
const swapFee = ref(0);
const sliderValue = ref(0);
const loading = ref(false);
const disabled = ref(false);
const sliderValueDec = ref(new Dec(0));

const reload = inject("reload", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const dialog = ref<typeof Dialog | null>(null);
const lease = ref<LeaseInfo | null>(null);
const displayData = ref<LeaseDisplayData | null>(null);

async function fetchLease() {
  try {
    const result = await leasesStore.fetchLeaseDetails(
      route.params.id as string,
      (route.params.protocol as string).toUpperCase()
    );
    if (result) {
      lease.value = result;
      displayData.value = leasesStore.getLeaseDisplayData(result);
      if (result.status === "closed") {
        router.push(`/${RouteNames.LEASES}`);
      }
    }
  } catch (error) {
    Logger.error(error);
  }
}

watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      fetchLease();
    }
  },
  { immediate: true }
);

onMounted(() => {
  dialog?.value?.show();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});
const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

function onSetAmount(percent: number) {
  const a = getRepayment(percent);
  sliderValue.value = percent;
  sliderValueDec.value = new Dec(percent);
  amount.value = a?.repayment ? a.repayment.toString(currency!.value.decimal_digits) : "";
}

const assets = computed(() => {
  const data = [];
  for (const asset of (balances.value as ExternalCurrency[]) ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatNumber(value.toString(), asset.decimal_digits);
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
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
      price: `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }
  return data;
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return `${NATIVE_CURRENCY.symbol}${formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
  }
  const price = new Dec(pricesStore.prices[asset.key!]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

const balances = computed(() => {
  return totalBalances.value.filter((item) => {
    const [ticker, protocol] = item.key.split("@");
    if (protocol != lease.value?.protocol) {
      return false;
    }

    if (
      ignoreDownpaymentAssets.value?.includes(ticker) ||
      ignoreDownpaymentAssets.value?.includes(`${ticker}@${protocol}`)
    ) {
      return false;
    }

    if (ProtocolsConfig[protocol].lease && !ProtocolsConfig[protocol].currencies.includes(ticker)) {
      return false;
    }

    const lpn = getLpnByProtocol(protocol);
    if (item.key != lpn.key) {
      return false;
    }

    return true;
  });
});

const totalBalances = computed(() => {
  const assets = [];

  for (const key in configStore.currenciesData ?? {}) {
    const currency = configStore.currenciesData![key];
    const c = { ...currency };
    const item = balancesStore.balances.find((item) => item.denom == currency.ibcData);
    if (item) {
      c.balance = item;
      assets.push(c);
    }
  }

  return assets;
});

function handleAmountChange(event: string) {
  amount.value = event;
  if (amount.value != "" && debt.value) {
    let percent = new Dec(amount.value).quo(debt.value.amount.toDec()).mul(new Dec(100));
    if (percent.isNegative()) {
      percent = new Dec(0);
    }
    if (percent.gt(new Dec(100))) {
      percent = new Dec(100);
    }
    sliderValueDec.value = percent;

    sliderValue.value = Number(percent.toString(0));
  }
}

const debt = computed(() => {
  const selectedCurrency = currency.value;
  if (selectedCurrency) {
    const { repayment, repaymentInStable } = getRepayment(100)!;
    const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

    return {
      amount: new CoinPretty(
        {
          coinDenom: selectedCurrency.shortName,
          coinMinimalDenom: selectedCurrency.ibcData,
          coinDecimals: selectedCurrency.decimal_digits
        },
        repaymentInt
      ).hideDenom(true)
    };
  }
});

function getRepayment(p: number) {
  if (!lease.value || lease.value.status !== "opened") return undefined;

  const amount = outStandingDebt();
  const lpn = getLpnByProtocol(lease.value.protocol);
  const c = lpn;

  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(
    amount.toString(),
    c.shortName,
    c.ibcData,
    c.decimal_digits
  ).toDec();

  const percent = new Dec(p).quo(new Dec(100));
  let repaymentInStable = amountToRepay.mul(percent);
  const selectedCurrency = currency.value;

  if (swapFee.value) {
    repaymentInStable = repaymentInStable.add(repaymentInStable.mul(new Dec(swapFee.value)));
  }

  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.short: {
      let lpn = getLpnByProtocol(lease.value.protocol);
      const price = new Dec(pricesStore.prices[lpn!.key as string].price);
      const selected_asset_price = new Dec(pricesStore.prices[selectedCurrency!.key as string].price);

      const repayment = repaymentInStable.mul(price);

      return {
        repayment: repayment.quo(selected_asset_price),
        repaymentInStable: repayment,
        selectedCurrencyInfo: selectedCurrency
      };
    }
    case PositionTypes.long: {
      const price = new Dec(pricesStore.prices[selectedCurrency!.key as string]?.price ?? 1);
      const repayment = repaymentInStable.quo(price);
      return {
        repayment,
        repaymentInStable,
        selectedCurrencyInfo: selectedCurrency
      };
    }
  }
}

function outStandingDebt() {
  if (!lease.value || lease.value.status !== "opened") return new Dec(0);

  const debt = new Dec(lease.value.debt.principal)
    .add(new Dec(lease.value.debt.overdue_margin))
    .add(new Dec(lease.value.debt.overdue_interest))
    .add(new Dec(lease.value.debt.due_margin))
    .add(new Dec(lease.value.debt.due_interest))
    .add(additionalInterest().roundUpDec());

  return debt;
}

function additionalInterest() {
  if (!lease.value || lease.value.status !== "opened") return new Dec(0);

  const principal_due = new Dec(lease.value.debt.principal);
  const loanInterest = new Dec(lease.value.interest.loan_rate / PERMILLE).add(
    new Dec(lease.value.interest.margin_rate / PERCENT)
  );
  const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

  return debt;
}

//Set SWAP FEE
const setSwapFee = async () => {
  clearTimeout(time);
  time = setTimeout(async () => {
    if (!lease.value) return;
    
    const lease_currency = currency.value;
    const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
    const currecy = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];

    const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
      debt.value!.amount.toDec().toString(),
      lease_currency.ibcData,
      lease_currency.decimal_digits
    ).amount.toString();

    let amountIn = 0;
    let amountOut = 0;
    const [r] = await Promise.all([
      SkipRouter.getRoute(lease_currency.ibcData, currecy.ibcData, microAmount).then((data) => {
        amountIn += Number(data.usd_amount_in ?? 0);
        amountOut += Number(data.usd_amount_out ?? 0);

        return Number(data?.swap_price_impact_percent ?? 0);
      })
    ]);

    const out_a = Math.max(amountOut, amountIn);
    const in_a = Math.min(amountOut, amountIn);

    const diff = out_a - in_a;
    let fee = 0;

    if (in_a > 0) {
      fee = diff / in_a;
    }

    swapFee.value = fee;
  }, timeOut);
};

function isAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";

  const amnt = amount.value;
  const coinData = currency.value;

  if (coinData) {
    if (amnt || amnt !== "") {
      const price = pricesStore.prices[coinData!.key as string];

      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amnt, "", coinData.decimal_digits);
      const balance = CurrencyUtils.calculateBalance(
        price.price,
        amountInMinimalDenom,
        coinData.decimal_digits
      ).toDec();
      const minAmount = new Dec(minimumLeaseAmount);
      const p = new Dec(price.price);
      const amountInStable = new Dec(amnt.length == 0 ? "0" : amnt).mul(p);

      const debt = getDebtValue();
      const lpn = getLpnByProtocol(lease.value!.protocol);
      const debtInCurrencies = debt.quo(new Dec(price.amount));
      const minAmm = new Dec(minimumLeaseAmount).mul(new Dec(10 ** lpn.decimal_digits));

      const minAmountCurrency = minAmount.quo(p);
      const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

      const isGreaterThanWalletBalance = new Int(amountInMinimalDenom.amount.toString() || "0").gt(
        coinData?.balance?.amount
      );

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (isGreaterThanWalletBalance) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-big");
        isValid = false;
      }

      if (debt.gt(minAmm) && amountInStable.lt(minAmount)) {
        amountErrorMsg.value = i18n.t("message.min-amount-allowed", {
          amount: minAmountCurrency.toString(Number(coinData!.decimal_digits)),
          currency: coinData!.shortName
        });
        isValid = false;
      }

      const b = CurrencyUtils.convertDenomToMinimalDenom(
        balance.toString(),
        "",
        coinData.decimal_digits
      ).amount.toDec();
      if (b.gt(debt) && debt.gt(minAmountCurrency)) {
        if (debt.gt(minAmm) && amountInStable.gt(minAmount)) {
          const n = new Dec(debtInCurrencies.truncate().toString(), coinData.decimal_digits);
          amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
            maxAmount: n.toString(coinData.decimal_digits),
            symbol: coinData.shortName
          });
        }

        isValid = false;
      }
    } else {
      amountErrorMsg.value = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
}

function getDebtValue() {
  let debt = outStandingDebt();
  debt = debt.add(debt.mul(new Dec(swapFee.value)));

  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(pricesStore.prices[lpn!.key as string].price);
      return debt.mul(price);
    }
  }
  return debt;
}

async function onSendClick() {
  try {
    disabled.value = true;
    await walletOperation(repayLease);
  } catch (e: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function repayLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid() && lease.value) {
    try {
      loading.value = true;

      const microAmount = getMicroAmount(currency.value.balance.denom, amount.value);
      const funds: Coin[] = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease.value.address);

      const { txBytes } = await leaseClient.simulateRepayLeaseTx(wallet, funds);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
      reload();
      dialog?.value?.close();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.toast-repaid")
      });
    } catch (e: Error | any) {
      amountErrorMsg.value = (e as Error).message;
      Logger.error(e);
    } finally {
      loading.value = false;
    }
  }
}

watch(
  () => [amount.value, selectedCurrency.value],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);

watch(
  () => [currency.value?.key],
  (currentValue, oldValue) => {
    // setSwapFee();
  },
  {
    deep: true
  }
);

function getPrice() {
  if (!lease.value || !displayData.value) return new Dec(0);
  return displayData.value.openingPrice;
}

const detbPartial = computed(() => {
  const price = getPrice();
  const debt = getRepayment(Number(sliderValueDec.value.toString()));
  const debtTotal = getRepayment(100);

  const d = debt?.repayment;
  if (price && d && debtTotal && lease.value) {
    const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
    const currecy = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];

    switch (ProtocolsConfig[lease.value.protocol].type) {
      case PositionTypes.short: {
        const rest = debtTotal.repayment.sub(d);
        return {
          payment: `${formatNumber(d.toString(), currecy?.decimal_digits ?? 6)} ${currecy?.shortName ?? ""}`,
          rest: `${formatNumber(rest.toString(), currecy?.decimal_digits ?? 6)} ${currecy?.shortName ?? ""}`
        };
      }
      case PositionTypes.long: {
        const asset = d;
        const rest = debtTotal.repayment.sub(d);
        let lpn = getLpnByProtocol(lease.value.protocol);
        return {
          payment: `${formatNumber(asset.toString(), lpn.decimal_digits)} ${lpn.shortName}`,
          rest: `${formatNumber(rest.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`
        };
      }
    }
  }

  return { payment: "", rest: "" };
});

const debtData = computed(() => {
  const price = getPrice();
  const debt = getRepayment(100);
  const d = debt?.repayment;

  if (price && d && lease.value) {
    const ticker = lease.value.etl_data?.lease_position_ticker ?? lease.value.amount.ticker;
    const currecy = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];

    switch (ProtocolsConfig[lease.value.protocol].type) {
      case PositionTypes.short: {
        return `${formatNumber(d.toString(), currecy?.decimal_digits ?? 6)} ${currecy?.shortName ?? ""}`;
      }
      case PositionTypes.long: {
        let lpn = getLpnByProtocol(lease.value.protocol);
        const asset = d;
        return `${formatNumber(asset.toString(), lpn.decimal_digits)} ${lpn.shortName}`;
      }
    }
  }

  return "";
});

const liquidation = computed(() => {
  if (!lease.value || lease.value.status !== "opened") {
    return `${NATIVE_CURRENCY.symbol}0.00`;
  }

  let liquidationVal = new Dec(0);
  const ticker = lease.value.amount.ticker;
  const unitAssetInfo = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];
  const lpn = getLpnByProtocol(lease.value.protocol);

  let unitAsset = new Dec(lease.value.amount.amount, Number(unitAssetInfo?.decimal_digits ?? 0));
  let stableAsset = new Dec(lease.value.debt.principal, Number(lpn?.decimal_digits ?? 0)).sub(
    new Dec(amount.value.length > 0 ? amount.value : 0)
  );

  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.long: {
      liquidationVal = LeaseUtils.calculateLiquidation(stableAsset, unitAsset);
      break;
    }
    case PositionTypes.short: {
      liquidationVal = LeaseUtils.calculateLiquidationShort(unitAsset, stableAsset);
      break;
    }
  }

  return `${NATIVE_CURRENCY.symbol}${formatNumber(liquidationVal.toString(), lpn?.decimal_digits ?? 6)}`;
});
</script>
