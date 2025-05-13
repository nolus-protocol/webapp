<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.repay`)"
    showClose
    :disable-close="true"
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
                  balance: item.balance.value,
                  max_decimals: item.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : item.decimal_digits
                })
            "
            :selected-currency-option="currency"
          />
          <div class="px-6 py-3">
            <Slider
              :min-position="0"
              :max-position="100"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-right="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`"
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
        <!-- <hr class="border-border-color" />
      <div class="flex justify-end px-6 py-4">
        <Button
          :label="$t('message.show-transaction-details')"
          severity="tertiary"
          icon="plus"
          iconPosition="left"
          size="small"
          class="text-icon-default"
        />
      </div> -->
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
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, getMicroAmount, LeaseUtils, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { MAX_DECIMALS, minimumLeaseAmount, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { CurrencyDemapping } from "@/config/currencies";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { h } from "vue";
import { useLease } from "@/common/composables";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { useI18n } from "vue-i18n";
import type { Coin } from "@cosmjs/proto-signing";
import { Lease } from "@nolus/nolusjs/build/contracts";

const timeOut = 250;
let time: NodeJS.Timeout;

const route = useRoute();
const router = useRouter();
const oracle = useOracleStore();
const walletStore = useWalletStore();
const app = useApplicationStore();
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
const reload = inject("reload", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const dialog = ref<typeof Dialog | null>(null);
const { lease } = useLease(
  route.params.id as string,
  route.params.protocol as string,
  (error) => {
    Logger.error(error);
  },
  true
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
  amount.value = a?.repayment ? a.repayment.toString(currency!.value.decimal_digits) : "";
}

const assets = computed(() => {
  const data = [];
  for (const asset of (balances.value as ExternalCurrency[]) ?? []) {
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
  return data;
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

    const lpn = AssetUtils.getLpnByProtocol(protocol);
    if (item.key != lpn.key) {
      return false;
    }

    return true;
  });
});

const totalBalances = computed(() => {
  const assets = [];

  for (const key in app.currenciesData ?? {}) {
    const currency = app.currenciesData![key];
    const c = { ...currency };
    const item = walletStore.balances.find((item) => item.balance.denom == currency.ibcData);
    if (item) {
      c.balance = item!.balance;
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
  const data = lease.value?.leaseStatus.opened!;

  const amount = outStandingDebt();
  const ticker = CurrencyDemapping[data.principal_due.ticker!]?.ticker ?? data.principal_due.ticker;
  const c = app.currenciesData![`${ticker!}@${lease.value!.protocol}`];

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

  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(oracle.prices[lpn!.key as string].amount);
      const selected_asset_price = new Dec(oracle.prices[selectedCurrency!.key as string].amount);

      const repayment = repaymentInStable.mul(price);

      return {
        repayment: repayment.quo(selected_asset_price),
        repaymentInStable: repayment,
        selectedCurrencyInfo: selectedCurrency
      };
    }
    case PositionTypes.long: {
      const price = new Dec(oracle.prices[selectedCurrency!.key as string].amount);
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
  const data = lease.value?.leaseStatus.opened;

  if (data) {
    const debt = new Dec(data.principal_due.amount)
      .add(new Dec(data.overdue_margin.amount))
      .add(new Dec(data.overdue_interest.amount))
      .add(new Dec(data.due_margin.amount))
      .add(new Dec(data.due_interest.amount))
      .add(additionalInterest().roundUpDec());

    return debt;
  }
  return new Dec(0);
}

function additionalInterest() {
  const data = lease.value?.leaseStatus.opened;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount);
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0);
}

const setSwapFee = async () => {
  clearTimeout(time);
  time = setTimeout(async () => {
    const lease_currency = currency.value;
    const currecy = app.currenciesData![`${lease.value?.leaseData!.leasePositionTicker}@${lease.value!.protocol}`];

    const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
      debt.value!.amount.toDec().toString(),
      lease_currency.ibcData,
      lease_currency.decimal_digits
    ).amount.toString();

    let amountIn = 0;
    let amountOut = 0;
    const [r] = await Promise.all([
      SkipRouter.getRoute(lease_currency.ibcData, currecy.ibcData, microAmount).then((data) => {
        amountIn += Number(data.usdAmountIn ?? 0);
        amountOut += Number(data.usdAmountOut ?? 0);

        return Number(data?.swapPriceImpactPercent ?? 0);
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
      const price = oracle.prices[coinData!.key as string];

      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amnt, "", coinData.decimal_digits);
      const balance = CurrencyUtils.calculateBalance(
        price.amount,
        amountInMinimalDenom,
        coinData.decimal_digits
      ).toDec();
      const minAmount = new Dec(minimumLeaseAmount);
      const p = new Dec(price.amount);
      const amountInStable = new Dec(amnt.length == 0 ? "0" : amnt).mul(p);

      const debt = getDebtValue();
      const lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
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
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(oracle.prices[lpn!.key as string].amount);
      return debt.mul(price);
    }
  }
  return debt;
}

async function onSendClick() {
  try {
    disabled.value = true;
    await walletOperation(repayLease);
  } catch (error: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function repayLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
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
      const leaseClient = new Lease(cosmWasmClient, lease?.value!.leaseAddress);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateRepayLeaseTx(wallet, funds);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
      reload();
      dialog?.value?.close();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.toast-repaid")
      });
    } catch (error: Error | any) {
      Logger.error(error);
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
    setSwapFee();
  },
  {
    deep: true
  }
);

function getPrice() {
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      return lease.value?.leaseData?.lpnPrice;
    }
    case PositionTypes.long: {
      return lease.value?.leaseData?.price;
    }
  }
}

const detbPartial = computed(() => {
  const price = getPrice();
  const debt = getRepayment(sliderValue.value);
  const debtTotal = getRepayment(100);

  const d = debt?.repayment;
  if (price && d && debtTotal) {
    const currecy = app.currenciesData![`${lease.value?.leaseData!.leasePositionTicker}@${lease.value!.protocol}`];

    switch (ProtocolsConfig[lease.value!.protocol].type) {
      case PositionTypes.short: {
        const asset = d.mul(price);
        const rest = debtTotal.repayment.sub(d);
        const restAsset = rest.mul(price);
        return {
          // payment: `${AssetUtils.formatNumber(d.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(asset.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`,

          payment: `${AssetUtils.formatNumber(d.toString(), currecy.decimal_digits)} ${currecy.shortName}`,
          rest: `${AssetUtils.formatNumber(rest.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(restAsset.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`
        };
      }
      case PositionTypes.long: {
        const asset = d.quo(price);
        const rest = debtTotal.repayment.sub(d);
        const restAsset = rest.quo(price);
        let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
        return {
          payment: `${AssetUtils.formatNumber(asset.toString(), lpn.decimal_digits)} ${lpn.shortName}`,
          rest: `${AssetUtils.formatNumber(restAsset.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(rest.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`
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

  if (price && d) {
    const currecy = app.currenciesData![`${lease.value?.leaseData!.leasePositionTicker}@${lease.value!.protocol}`];

    switch (ProtocolsConfig[lease.value!.protocol].type) {
      case PositionTypes.short: {
        const asset = d.mul(price);
        // return `${AssetUtils.formatNumber(d.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(asset.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`;
        return `${AssetUtils.formatNumber(d.toString(), currecy.decimal_digits)} ${currecy.shortName}`;
      }
      case PositionTypes.long: {
        let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
        const asset = d.quo(price);
        return `${AssetUtils.formatNumber(asset.toString(), lpn.decimal_digits)} ${lpn.shortName}`;
      }
    }
  }

  return "";
});

const liquidation = computed(() => {
  const leaseInfo = lease.value?.leaseStatus.opened;
  if (!leaseInfo) {
    return `${NATIVE_CURRENCY.symbol}0.00`;
  }

  let liquidation = new Dec(0);
  const ticker = CurrencyDemapping[leaseInfo.amount.ticker!]?.ticker ?? leaseInfo.amount.ticker;
  const unitAssetInfo = app.currenciesData![`${ticker!}@${lease.value?.protocol}`];
  const stableTicker = CurrencyDemapping[leaseInfo.principal_due.ticker!]?.ticker ?? leaseInfo.principal_due.ticker;
  const stableAssetInfo = app.currenciesData![`${stableTicker!}@${lease.value?.protocol}`];

  let unitAsset = new Dec(leaseInfo.amount.amount, Number(unitAssetInfo!.decimal_digits));
  let stableAsset = new Dec(leaseInfo.principal_due.amount, Number(stableAssetInfo!.decimal_digits)).sub(
    new Dec(amount.value.length > 0 ? amount.value : 0)
  );

  switch (ProtocolsConfig[lease.value?.protocol!].type) {
    case PositionTypes.long: {
      liquidation = LeaseUtils.calculateLiquidation(stableAsset, unitAsset);
      break;
    }
    case PositionTypes.short: {
      liquidation = LeaseUtils.calculateLiquidationShort(unitAsset, stableAsset);
      break;
    }
  }

  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(liquidation.toString(), stableAssetInfo.decimal_digits)}`;
});
</script>
