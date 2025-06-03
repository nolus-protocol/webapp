<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.close`)"
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
          <div class="mt-2 px-4 py-3">
            <Slider
              :min-position="0"
              :max-position="100"
              :mid-position="midPosition"
              :value="sliderValue"
              @on-drag="onSetAmount"
              :label-left="`0`"
              :label-mid="`${$t('message.debt')} (~${debt?.amount?.toString() ?? ''})`"
              :label-right="`${$t('message.full-position')} (~${AssetUtils.formatNumber(total?.toString(currency?.decimal_digits), currency?.decimal_digits) ?? ''})`"
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

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="info"
                  class="fill-icon-secondary"
                />
                {{ positionLeft }} {{ $t("message.preview-closed-rest") }}
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
                  name="info"
                  class="fill-icon-secondary"
                />
                {{ positionLeft }} {{ $t("message.preview-closed-rest") }}
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

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="check-solid"
                  class="fill-icon-success"
                />
                {{ $t("message.preview-closed-paid") }}
                <strong>{{ payout }} {{ lpn }}</strong>
              </div>

              <div class="flex items-center gap-2 text-14">
                <SvgIcon
                  name="info"
                  class="fill-icon-secondary"
                />
                {{ positionLeft }} {{ $t("message.preview-closed-rest") }}
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
                {{ $t("message.preview-closed-paid") }}
                <strong>{{ payout }} {{ lpn }}</strong>
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
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils, getMicroAmount, LeaseUtils, Logger, walletOperation } from "@/common/utils";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { MAX_DECIMALS, minimumLeaseAmount, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { CurrencyDemapping } from "@/config/currencies";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { CoinPretty, Dec, Int } from "@keplr-wallet/unit";
import { useLease, useLeaseConfig } from "@/common/composables";
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
const { config } = useLeaseConfig(
  (route.params.protocol as string).toUpperCase() as string,
  (error: Error | any) => {}
);

onMounted(() => {
  dialog?.value?.show();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const assets = computed(() => {
  const data = [];

  if (lease.value) {
    const ticker =
      CurrencyDemapping[lease.value?.leaseStatus?.opened?.amount?.ticker!]?.ticker ??
      lease.value?.leaseStatus?.opened?.amount?.ticker;
    const asset = app.currenciesData![`${ticker}@${lease.value!.protocol}`];
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
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);

      return new Dec(oracle.prices[lpn?.key]?.amount, lpn?.decimal_digits).toString(lpn?.decimal_digits);
    }
    case PositionTypes.long: {
      return new Dec(oracle.prices[currency.value?.key]?.amount, currency.value?.decimal_digits).toString(
        currency.value?.decimal_digits
      );
    }
  }
});

const remaining = computed(() => {
  const data = getAmountValue(amount.value == "" ? "0" : amount.value);
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(oracle.prices?.[lpn.key!]?.amount ?? 0);
      const stable = data.amount.toDec().quo(price);

      return `${AssetUtils.formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
    case PositionTypes.long: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      return `${AssetUtils.formatNumber(data.amountInStable.toDec().toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
  }
});

const paidDebt = computed(() => {
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(oracle.prices?.[lpn.key!]?.amount ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = new Dec(v).quo(price);

      return `${AssetUtils.formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
    case PositionTypes.long: {
      const asset = assets.value[selectedCurrency.value];
      if (!asset) {
        return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
      }
      const price = new Dec(oracle.prices?.[asset.key!]?.amount ?? 0);
      const v = amount?.value?.length ? amount?.value : "0";
      const stable = price.mul(new Dec(v));
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);

      return `${AssetUtils.formatNumber(stable.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`;
    }
  }
});

const debtData = computed(() => {
  const price = getPrice();
  const debt = getRepayment(100);
  const d = debt?.repayment;

  if (price && d) {
    const currecy = app.currenciesData![`${lease.value?.leaseData!.leasePositionTicker}@${lease.value!.protocol}`];
    switch (ProtocolsConfig[lease.value!.protocol].type) {
      case PositionTypes.short: {
        const asset = d.quo(price);
        const value = d.mul(new Dec(swapFee.value));
        return {
          fee: `${(swapFee.value * PERCENT).toFixed(NATIVE_CURRENCY.maximumFractionDigits)}% (${NATIVE_CURRENCY.symbol}${value.toString(NATIVE_CURRENCY.maximumFractionDigits)})`,
          asset: currecy.shortName,
          price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(price.toString(MAX_DECIMALS), MAX_DECIMALS)}`,
          // debt: `${AssetUtils.formatNumber(asset.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(d.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`
          debt: `${AssetUtils.formatNumber(asset.toString(), currecy.decimal_digits)} ${currecy.shortName}`
        };
      }
      case PositionTypes.long: {
        const asset = d.mul(price);
        const value = asset.mul(new Dec(swapFee.value));
        let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);

        return {
          fee: `${(swapFee.value * PERCENT).toFixed(NATIVE_CURRENCY.maximumFractionDigits)}% (${NATIVE_CURRENCY.symbol}${value.toString(NATIVE_CURRENCY.maximumFractionDigits)})`,
          asset: currecy.shortName,
          price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(price.toString(MAX_DECIMALS), MAX_DECIMALS)}`,
          debt: ` ${AssetUtils.formatNumber(asset.toString(lpn.decimal_digits), lpn.decimal_digits)} ${lpn.shortName}`
          // debt: `${AssetUtils.formatNumber(d.toString(), currecy.decimal_digits)} ${currecy.shortName} (${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(asset.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)})`
        };
      }
    }
  }

  return { debt: "", price: "", asset: "", fee: "" };
});

const total = computed(() => {
  return new Dec(lease.value?.leaseStatus.opened?.amount.amount ?? 0, currency.value?.decimal_digits);
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
  const lpn = AssetUtils.getLpnByProtocol(protocol);

  for (const lpn of app.lpn ?? []) {
    const [_, p] = lpn.key.split("@");
    if (p == protocol) {
      return lpn.shortName;
    }
  }
  return lpn.shortName;
});

const payout = computed(() => {
  const leaseInfo = lease.value?.leaseStatus.opened!;
  const ticker = CurrencyDemapping[leaseInfo.amount.ticker!]?.ticker ?? leaseInfo.amount.ticker;
  const currency = app.currenciesData![`${ticker!}@${lease.value?.protocol}`];
  const price = new Dec(oracle.prices[currency!.key as string]?.amount ?? 0);
  const value = new Dec(amount.value.length == 0 ? 0 : amount.value).mul(price);

  const outStanding = getAmountValue("0").amountInStable.toDec();
  let payOutValue = value.sub(outStanding);

  if (payOutValue.isNegative()) {
    return "0.00";
  }

  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);
      const price = new Dec(oracle.prices[lpn!.key as string].amount);
      payOutValue = payOutValue.quo(price);

      break;
    }
  }
  let lpn = AssetUtils.getLpnByProtocol(lease.value!.protocol);

  return payOutValue.toString(Number(lpn.decimal_digits));
});

const positionLeft = computed(() => {
  const leaseInfo = lease.value?.leaseStatus.opened!;

  const ticker = CurrencyDemapping[leaseInfo.amount.ticker!]?.ticker ?? leaseInfo.amount.ticker;
  const currency = app.currenciesData![`${ticker!}@${lease.value!.protocol}`];
  const a = new Dec(leaseInfo.amount.amount, Number(currency!.decimal_digits));
  const value = new Dec(amount.value.length == 0 ? 0 : amount.value);
  const left = a.sub(value);

  if (left.isNegative()) {
    return "0.00";
  }

  return `${left.toString(Number(currency!.decimal_digits))} ${currency!.shortName}`;
});

function onSetAmount(percent: number) {
  sliderValue.value = percent;
  const a = total.value.mul(new Dec(percent).quo(new Dec(100)));
  amount.value = a.toString(currency!.value.decimal_digits);
}
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

async function setSwapFee() {
  clearTimeout(time);
  time = setTimeout(async () => {
    const lease_currency = currency.value;
    let currecy = AssetUtils.getLpnByProtocol(lease.value?.protocol as string);
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
        const currecy = app.currenciesData![`${stable}@${lease.value!.protocol}`];
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
  if (lease.value) {
    const a = amount.value;
    const currency = AssetUtils.getCurrencyByTicker(lease.value.leaseStatus.opened!.amount.ticker!);
    const debt = new Dec(lease.value.leaseStatus.opened!.amount.amount, Number(currency.decimal_digits));
    const minAmountCurrency = AssetUtils.getCurrencyByTicker(
      config.value?.config.lease_position_spec.min_asset.ticker as string
    )!;
    let minAmont = new Dec(
      config.value?.config.lease_position_spec.min_asset.amount ?? 0,
      Number(minAmountCurrency.decimal_digits)
    );

    switch (ProtocolsConfig[lease.value!.protocol].type) {
      case PositionTypes.short: {
        const p = new Dec(
          oracle.prices[
            `${config.value?.config.lease_position_spec.min_asset.ticker as string}@${lease.value!.protocol}`
          ].amount
        );

        minAmont = minAmont.mul(p);
        break;
      }
    }
    const price = new Dec(oracle.prices[currency.key as string].amount);

    const minAmountTemp = new Dec(minimumLeaseAmount);
    const amountInStable = new Dec(a.length == 0 ? "0" : a).mul(price);
    if (amount || amount !== "") {
      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(a, "", Number(currency.decimal_digits));
      const value = new Dec(amountInMinimalDenom.amount, Number(currency.decimal_digits));

      const isLowerThanOrEqualsToZero = new Dec(amountInMinimalDenom.amount || "0").lte(new Dec(0));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (amountInStable.lt(minAmountTemp)) {
        amountErrorMsg.value = i18n.t("message.min-amount-allowed", {
          amount: minAmountTemp.quo(price).toString(Number(currency.decimal_digits)),
          currency: currency.shortName
        });
        isValid = false;
      } else if (value.gt(debt)) {
        amountErrorMsg.value = i18n.t("message.lease-only-max-error", {
          maxAmount: Number(debt.toString(Number(currency.decimal_digits))),
          symbol: currency.shortName
        });
        isValid = false;
      } else if (!value.equals(debt) && debt.sub(value).mul(price).lte(minAmont)) {
        amountErrorMsg.value = i18n.t("message.lease-min-amount", {
          amount: Number(minAmont.quo(price).toString(Number(currency.decimal_digits))),
          symbol: currency.shortName
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
  switch (ProtocolsConfig[lease.value!.protocol].type) {
    case PositionTypes.short: {
      return lease.value?.leaseData?.lpnPrice;
    }
    case PositionTypes.long: {
      return lease.value?.leaseData?.price;
    }
  }
}

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
      const price = getPrice()!;
      const selected_asset_price = new Dec(oracle.prices[selectedCurrency!.key as string].amount);

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
  } catch (error: Error | any) {
  } finally {
    disabled.value = false;
  }
}

async function marketCloseLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    try {
      loading.value = true;
      const funds: Coin[] = [];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, lease?.value!.leaseAddress);

      const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(wallet, getCurrency(), funds);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      reload();
      dialog?.value?.close();
      walletStore.loadActivities();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.toast-closed")
      });
    } catch (error: Error | any) {
      Logger.error(error);
    } finally {
      loading.value = false;
    }
  }
}

function getCurrency() {
  const microAmount = getMicroAmount(currency.value.ibcData, amount.value);
  const a = new Int(lease.value?.leaseStatus.opened?.amount.amount ?? 0);

  if (a.equals(microAmount.mAmount.amount)) {
    return undefined;
  }

  const c = currency.value;

  return {
    ticker: c.ticker,
    amount: microAmount.mAmount.amount.toString()
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
  const lpn = AssetUtils.getLpnByProtocol(protocolKey);

  let amount = new Dec(a);
  const price = new Dec(oracle.prices[selectedCurrency!.key as string]?.amount ?? 0);
  const { repayment, repaymentInStable } = getRepayment(100)!;

  const amountInStableInt = amount
    .mul(price)
    .mul(new Dec(10).pow(new Int(lpn.decimal_digits)))
    .truncate();
  const amountInt = amount.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();

  const repaymentInt = repayment.mul(new Dec(10).pow(new Int(selectedCurrency.decimal_digits))).truncate();
  const repaymentInStableInt = repaymentInStable.mul(new Dec(10).pow(new Int(lpn.decimal_digits))).truncate();

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
        coinDenom: lpn.shortName,
        coinMinimalDenom: lpn.ibcData,
        coinDecimals: Number(lpn.decimal_digits)
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
