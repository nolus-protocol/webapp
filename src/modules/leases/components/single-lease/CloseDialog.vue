<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.close`)"
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
      <div class="custom-scroll max-h-full flex-1 overflow-auto">
        <hr class="border-border-color" />
        <div class="flex flex-col gap-4 px-6 py-4">
          <AdvancedFormControl
            id="repay-close"
            labelAdvanced
            :currencyOptions="assets"
            :disabled-currency-picker="isLoading"
            :disabled-input-field="isLoading"
            :selectedCurrencyOption="assets[0]"
            :calculated-balance="calculatedBalance"
            :value-only="amount"
            @input="handleAmountChange"
            :error-msg="amountErrorMsg"
            placeholder="0"
          >
            <template v-slot:label>
              <div class="flex items-center gap-1">
                {{ $t("message.amount-to-close") }}
                <span class="flex items-center gap-1 font-normal"
                  ><img :src="currency?.icon" /> {{ currency?.label }}</span
                >
                <Tooltip :content="$t('message.close-dialog-tooltip')"
                  ><SvgIcon
                    name="help"
                    class="fill-icon-link"
                /></Tooltip>
              </div>
            </template>
          </AdvancedFormControl>
          <!-- :label-mid="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`" -->
          <!-- :label-right="`${$t('message.full-position')} (~${AssetUtils.formatNumber(total?.toString(currency?.decimal_digits), currency?.decimal_digits) ?? ''})`" -->
          <div class="mt-2 px-4 py-3">
            <Slider
              :min-position="0"
              :max-position="100"
              :mid-position="midPosition"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-mid="`${$t('message.debt')}`"
              :label-right="`${$t('message.full-position')}`"
              @click-right-label="() => onSetAmount(100)"
              @click-left-label="() => onSetAmount(0)"
              @click-mid-label="
                () => {
                  handleAmountChange(debt?.amount?.toString() ?? '0');
                }
              "
            />
          </div>
        </div>
        <hr class="border-border-color" />
        <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
          <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
          <template v-if="lease">
            <template v-if="sliderValue == 0">
              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="list-sparkle"
                  class="fill-icon-secondary"
                />
                {{ $t("message.preview-input") }}
              </div>
            </template>

            <template v-if="sliderValue > 0 && sliderValue < midPosition">
              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <p
                  class="flex-1"
                  :innerHTML="
                    $t('message.preview-closed-paid-partuial-debt', {
                      amount: paidDebt,
                      price: `${NATIVE_CURRENCY.symbol}${price}`,
                      asset: debtData.asset,
                      fee: debtData.fee
                    })
                  "
                ></p>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="info"
                  class="fill-icon-secondary"
                />
                {{ $t("message.preview-closed-debt") }} {{ remaining }}
              </div>
            </template>

            <template v-if="sliderValue == midPosition">
              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <p
                  class="flex-1"
                  :innerHTML="
                    $t('message.preview-closed-paid-debt', {
                      amount: debtData.debt,
                      price: `${NATIVE_CURRENCY.symbol}${price}`,
                      asset: debtData.asset,
                      fee: debtData.fee
                    })
                  "
                ></p>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ positionLeft }} {{ $t("message.preview-closed-rest") }}
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ $t("message.preview-closed") }}
              </div>
            </template>

            <template v-if="sliderValue > midPosition && sliderValue < 100">
              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <p
                  class="flex-1"
                  :innerHTML="
                    $t('message.preview-closed-paid-debt', {
                      amount: debtData.debt,
                      price: `${NATIVE_CURRENCY.symbol}${price}`,
                      asset: debtData.asset,
                      fee: debtData.fee
                    })
                  "
                ></p>
              </div>

              <!-- <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ $t("message.preview-closed-paid") }}
                <strong>{{ payout }} {{ lpn }}</strong>
              </div> -->

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <div>
                  <strong>{{ payout }} {{ lpn }}</strong> {{ $t("message.and") }} <strong>{{ positionLeft }}</strong>
                  {{ $t("message.preview-closed-rest") }}
                </div>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ $t("message.preview-closed") }}
              </div>
            </template>

            <template v-if="sliderValue >= 100">
              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <p
                  class="flex-1"
                  :innerHTML="
                    $t('message.preview-closed-paid-debt', {
                      amount: debtData.debt,
                      price: `${NATIVE_CURRENCY.symbol}${price}`,
                      asset: debtData.asset,
                      fee: debtData.fee
                    })
                  "
                ></p>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                <div>
                  <strong>{{ payout }} {{ lpn }}</strong>
                  {{ $t("message.preview-closed-rest") }}
                </div>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ $t("message.preview-closed") }}
              </div>
            </template>
          </template>
        </div>
        <hr class="border-border-color" />
      </div>

      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.close-btn-label`)"
          @click="onSendClick"
          :disabled="disabled"
          :loading="loading"
        />
        <p class="text-center text-12 text-typography-secondary">
          {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseCloseEstimation }}{{ $t("message.min") }}
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AdvancedFormControl, Button, Dialog, Tooltip, Slider, SvgIcon, ToastType } from "web-components";
import { RouteNames } from "@/router";

import { useWalletStore } from "@/common/stores/wallet";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { getMicroAmount, LeaseUtils, Logger, walletOperation } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol, getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { MAX_DECIMALS, minimumLeaseAmount, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
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
const configStore = useConfigStore();
const leasesStore = useLeasesStore();
const i18n = useI18n();

const amount = ref("");
const amountErrorMsg = ref("");
const selectedCurrency = ref(0);
const isLoading = ref(false);
const swapFee = ref(0);
const sliderValue = ref(0);
const loading = ref(false);
const disabled = ref(false);
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

const config = computed(() => {
  const protocol = (route.params.protocol as string).toUpperCase();
  return configStore.contracts[protocol];
});

onMounted(() => {
  dialog?.value?.show();
  fetchLease();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const assets = computed(() => {
  const data = [];

  if (lease.value && lease.value.status === "opened") {
    const ticker = lease.value.amount.ticker;
    const asset = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;

    data.push({
      name: asset.name,
      icon: asset.icon,
      value: denom,
      label: asset.shortName,
      ibcData: asset.ibcData,
      shortName: asset.shortName,
      decimal_digits: asset.decimal_digits!,
      key: asset.key,
      ticker: asset.ticker
    });
  }

  return data;
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const price = computed(() => {
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = getLpnByProtocol(lease.value!.protocol);

      return new Dec(pricesStore.prices[lpn?.key]?.price, lpn?.decimal_digits).toString(lpn?.decimal_digits);
    }
    case PositionTypes.long: {
      return new Dec(pricesStore.prices[currency.value?.key]?.price, currency.value?.decimal_digits).toString(
        currency.value?.decimal_digits
      );
    }
  }
});

const remaining = computed(() => {
  const data = getAmountValue(amount.value == "" ? "0" : amount.value);
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(pricesStore.prices[lpn.key!]?.price ?? 0);
      const stable = data.amount.toDec().quo(price);

      return `${formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
    case PositionTypes.long: {
      let lpn = getLpnByProtocol(lease.value!.protocol);
      return `${formatNumber(data.amountInStable.toDec().toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
  }
});

const paidDebt = computed(() => {
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(pricesStore.prices[lpn.key!]?.price ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = new Dec(v).quo(price);

      return `${formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
    case PositionTypes.long: {
      const asset = assets.value[selectedCurrency.value];
      if (!asset) {
        return `${NATIVE_CURRENCY.symbol}${formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
      }
      const price = new Dec(pricesStore.prices[asset.key!]?.price ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = price.mul(new Dec(v));
      let lpn = getLpnByProtocol(lease.value!.protocol);

      return `${formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
  }
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
        const asset = d.quo(price);
        const value = new Dec(amount.value).mul(new Dec(swapFee.value));
        return {
          fee: `${(swapFee.value * PERCENT).toFixed(NATIVE_CURRENCY.maximumFractionDigits)}% (${NATIVE_CURRENCY.symbol}${value.toString(NATIVE_CURRENCY.maximumFractionDigits)})`,
          asset: currecy.shortName,
          price: `${NATIVE_CURRENCY.symbol}${formatNumber(price.toString(MAX_DECIMALS), MAX_DECIMALS)}`,
          debt: `${formatNumber(asset.toString(), currecy.decimal_digits)} ${currecy.shortName}`
        };
      }
      case PositionTypes.long: {
        const asset = d.mul(price);
        const value = new Dec(amount.value).mul(price).mul(new Dec(swapFee.value));
        let lpn = getLpnByProtocol(lease.value.protocol);

        return {
          fee: `${(swapFee.value * PERCENT).toFixed(NATIVE_CURRENCY.maximumFractionDigits)}% (${NATIVE_CURRENCY.symbol}${value.toString(NATIVE_CURRENCY.maximumFractionDigits)})`,
          asset: currecy.shortName,
          price: `${NATIVE_CURRENCY.symbol}${formatNumber(price.toString(MAX_DECIMALS), MAX_DECIMALS)}`,
          debt: ` ${formatNumber(asset.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`
        };
      }
    }
  }

  return { debt: "", price: "", asset: "", fee: "" };
});

const total = computed(() => {
  if (!lease.value || lease.value.status !== "opened") return new Dec(0);
  return new Dec(lease.value.amount.amount ?? 0, currency.value?.decimal_digits);
});

const debt = computed(() => {
  const selectedCurrency = currency.value;
  if (selectedCurrency) {
    const { repayment, repaymentInStable } = getRepayment(100)!;
    const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

    return {
      amountInStable: new CoinPretty(
        {
          coinDenom: selectedCurrency.shortName,
          coinMinimalDenom: selectedCurrency.ibcData,
          coinDecimals: selectedCurrency.decimal_digits
        },
        repaymentInStable
      )
        .trim(true)
        .maxDecimals(4)
        .hideDenom(true),
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

const lpn = computed(() => {
  const [_key, protocol] = currency.value.key.split("@");
  const lpnData = getLpnByProtocol(protocol);

  for (const lpn of configStore.lpn ?? []) {
    const [_, p] = lpn.key.split("@");
    if (p == protocol) {
      return lpn.shortName;
    }
  }
  return lpnData.shortName;
});

const payout = computed(() => {
  if (!lease.value || lease.value.status !== "opened") return "0.00";
  const ticker = lease.value.amount.ticker;
  const currencyData = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];
  const price = new Dec(pricesStore.prices[currencyData!.key as string]?.price ?? 0);
  const value = new Dec(amount.value.length == 0 ? 0 : amount.value).mul(price);

  const outStanding = getAmountValue("0").amountInStable.toDec();
  let payOutValue = value.sub(outStanding);

  if (payOutValue.isNegative()) {
    return "0.00";
  }

  switch (ProtocolsConfig[lease.value.protocol].type) {
    case PositionTypes.short: {
      let lpnData = getLpnByProtocol(lease.value.protocol);
      const price = new Dec(pricesStore.prices[lpnData!.key as string].price);
      payOutValue = payOutValue.quo(price);

      break;
    }
  }
  let lpnData = getLpnByProtocol(lease.value.protocol);

  return payOutValue.toString(Number(lpnData.decimal_digits));
});

const positionLeft = computed(() => {
  if (!lease.value || lease.value.status !== "opened") return "0.00";

  const ticker = lease.value.amount.ticker;
  const currencyData = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];
  const a = new Dec(lease.value.amount.amount, Number(currencyData!.decimal_digits));
  const value = new Dec(amount.value.length == 0 ? 0 : amount.value);
  const left = a.sub(value);

  if (left.isNegative()) {
    return "0.00";
  }

  return `${left.toString(Number(currencyData!.decimal_digits))} ${currencyData!.shortName}`;
});

function onSetAmount(percent: number) {
  sliderValue.value = percent;
  const a = total.value.mul(new Dec(percent).quo(new Dec(100)));
  amount.value = a.toString(currency!.value.decimal_digits);
}
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
const midPosition = computed(() => {
  const d = debt.value?.amount.toDec() ?? new Dec(0);

  if (total.value.isZero()) {
    return 0;
  }

  return Number(d.quo(total.value).mul(new Dec(100)).toString());
});

function handleAmountChange(event: string) {
  amount.value = event;
  if (amount.value != "") {
    let percent = new Dec(amount.value).quo(total.value).mul(new Dec(100));
    if (percent.isNegative()) {
      percent = new Dec(0);
    }
    if (percent.gt(new Dec(100))) {
      percent = new Dec(100);
    }
    sliderValue.value = Number(percent);
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

async function setSwapFee() {
  clearTimeout(time);
  time = setTimeout(async () => {
    const lease_currency = currency.value;
    let currecy = getLpnByProtocol(lease.value?.protocol as string);
    let microAmount = CurrencyUtils.convertDenomToMinimalDenom(
      debt.value!.amount.toDec().toString(),
      lease_currency.ibcData,
      lease_currency.decimal_digits
    ).amount.toString();

    let amountIn = 0;
    let amountOut = 0;

    switch (ProtocolsConfig[lease.value?.protocol!].type) {
      case PositionTypes.short: {
        const stable = ProtocolsConfig[lease.value!.protocol].stable;
        const currecy = configStore.currenciesData![`${stable}@${lease.value!.protocol}`];
        microAmount = CurrencyUtils.convertDenomToMinimalDenom(
          debt.value!.amount.toDec().toString(),
          currecy.ibcData,
          currecy.decimal_digits
        ).amount.toString();
        break;
      }
    }
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
}

function isAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";
  if (lease.value && lease.value.status === "opened") {
    const a = amount.value;
    const currencyData = configStore.currenciesData![`${lease.value.amount.ticker}@${lease.value.protocol}`];
    const debtAmount = new Dec(lease.value.amount.amount, Number(currencyData.decimal_digits));
    const minAssetTicker = config.value?.config.lease_position_spec.min_asset.ticker as string;
    const minAmountCurrency = getCurrencyByTicker(minAssetTicker)!;
    let minAmont = new Dec(
      config.value?.config.lease_position_spec.min_asset.amount ?? 0,
      Number(minAmountCurrency.decimal_digits)
    );

    switch (ProtocolsConfig[lease.value.protocol].type) {
      case PositionTypes.short: {
        const p = new Dec(
          pricesStore.prices[`${minAssetTicker}@${lease.value.protocol}`].price
        );

        minAmont = minAmont.mul(p);
        break;
      }
    }
    const price = new Dec(pricesStore.prices[currencyData.key as string].price);

    const minAmountTemp = new Dec(minimumLeaseAmount);
    const amountInStable = new Dec(a.length == 0 ? "0" : a).mul(price);
    if (amount || amount !== "") {
      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(a, "", Number(currencyData.decimal_digits));
      const value = new Dec(amountInMinimalDenom.amount, Number(currencyData.decimal_digits));

      const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (amountInStable.lt(minAmountTemp)) {
        amountErrorMsg.value = i18n.t("message.min-amount-allowed", {
          amount: minAmountTemp.quo(price).toString(Number(currencyData.decimal_digits)),
          currency: currencyData.shortName
        });
        isValid = false;
      } else if (value.gt(debtAmount)) {
        amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
          maxAmount: Number(debtAmount.toString(Number(currencyData.decimal_digits))),
          symbol: currencyData.shortName
        });
        isValid = false;
      } else if (!value.equals(debtAmount) && debtAmount.sub(value).mul(price).lte(minAmont)) {
        amountErrorMsg.value = i18n.t("message.lease-min-amount", {
          amount: Number(minAmont.quo(price).toString(Number(currencyData.decimal_digits))),
          symbol: currencyData.shortName
        });
        isValid = false;
      }
    } else {
      amountErrorMsg.value = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
}

function getPrice() {
  if (!lease.value || !displayData.value) return undefined;
  return displayData.value.openingPrice;
}

function getRepayment(p: number) {
  if (!lease.value || lease.value.status !== "opened") return undefined;

  const amount = outStandingDebt();
  const ticker = lease.value.debt.ticker;
  const c = configStore.currenciesData![`${ticker}@${lease.value.protocol}`];

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
      let lpnData = getLpnByProtocol(lease.value.protocol);
      const price = getPrice()!;
      const selected_asset_price = new Dec(pricesStore.prices[selectedCurrency!.key as string].price);

      const repayment = repaymentInStable.mul(price);

      return {
        repayment: repayment.quo(selected_asset_price),
        repaymentInStable: repayment,
        selectedCurrencyInfo: selectedCurrency
      };
    }
    case PositionTypes.long: {
      const price = getPrice()!;
      const repayment = repaymentInStable.quo(price);
      return {
        repayment,
        repaymentInStable,
        selectedCurrencyInfo: selectedCurrency
      };
    }
  }
}
async function onSendClick() {
  try {
    disabled.value = true;
    await walletOperation(marketCloseLease);
  } catch (e: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function marketCloseLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid() && lease.value) {
    try {
      loading.value = true;
      const funds: Coin[] = [];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease.value.address);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(wallet, getCurrency(), funds);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      reload();
      dialog?.value?.close();
      walletStore.loadActivities();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.toast-closed")
      });
    } catch (e: Error | any) {
      Logger.error(e);
      amountErrorMsg.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }
}

function getCurrency() {
  if (!lease.value || lease.value.status !== "opened") return undefined;
  
  const microAmount = getMicroAmount(currency.value.ibcData, amount.value);
  const a = new Int(lease.value.amount.amount ?? 0);

  if (a.equals(microAmount.mAmount.amount)) {
    return undefined;
  }

  const c = currency.value;

  return {
    amount: microAmount.mAmount.amount.toString(),
    ticker: c.ticker
  };
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

function getAmountValue(a: string) {
  const selectedCurrency = assets.value[0];
  const [_, protocolKey] = selectedCurrency.key.split("@");
  const lpnData = getLpnByProtocol(protocolKey);

  let amount = new Dec(a);
  const price = new Dec(pricesStore.prices[selectedCurrency!.key as string]?.price ?? 0);
  const { repayment, repaymentInStable } = getRepayment(100)!;

  const amountInStableInt = amount
    .mul(price)
    .mul(new Dec(10).pow(new Int(lpnData.decimal_digits)))
    .truncate();
  const amountInt = amount.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

  const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();
  const repaymentInStableInt = repaymentInStable.mul(new Dec(10).pow(new Int(lpnData.decimal_digits))).truncate();

  let vStable = repaymentInStableInt.sub(amountInStableInt);
  let v = repaymentInt.sub(amountInt);

  if (vStable.isNegative()) {
    vStable = new Int(0);
  }

  if (v.isNegative()) {
    v = new Int(0);
  }

  return {
    amountInStable: new CoinPretty(
      {
        coinDenom: lpnData.shortName,
        coinMinimalDenom: lpnData.ibcData,
        coinDecimals: Number(lpnData.decimal_digits)
      },
      vStable
    )
      .trim(true)
      .hideDenom(true),
    amount: new CoinPretty(
      {
        coinDenom: selectedCurrency.shortName,
        coinMinimalDenom: selectedCurrency.ibcData,
        coinDecimals: selectedCurrency.decimal_digits
      },
      v
    )
  };
}
</script>
