<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.position-summary')"
      :icon="{ name: 'bar-chart', class: 'fill-icon-link' }"
    />

    <EmptyState
      v-if="status == TEMPLATES.opening"
      :slider="[
        {
          image: { name: 'position-summary' },
          title: $t('message.position-summary-lease'),
          description: $t('message.position-summary-lease-description'),
          link: {
            label: $t('message.learn-more-leases'),
            onClick: () => IntercomService.askQuestion('Can you explain how positions work?')
          }
        }
      ]"
    />

    <div
      v-else
      class="!md:flex-col flex flex-col-reverse gap-6 md:flex-row md:gap-10"
    >
      <div class="flex flex-col gap-3">
        <BigNumber
          :loading="loading"
          loadingWidth="200px"
          :label="$t('message.lease-size')"
          :amount="sizePrimary"
          :secondary="sizeSecondary"
        />
        <div class="flex flex-col gap-8 md:flex-row">
          <div class="flex flex-col gap-4">
            <BigNumber
              :loading="loading"
              :label="$t('message.outstanding-loan')"
              :label-tooltip="{ content: $t('message.outstanding-loan-tooltip') }"
              :amount="{
                microAmount: debt,
                denom: lpn?.shortName ?? '',
                decimals: lpn?.decimal_digits ?? 0,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="`${$t('message.price-per-asset')} ${pricerPerAsset?.shortName}`"
              :amount="{
                value: openedPrice,
                denom: NATIVE_CURRENCY.symbol,
                decimals: openedPriceDecimals,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.partial-liquidation')"
              :label-tooltip="{ content: $t('message.partial-liquidation-tooltip') }"
              :amount="{
                value: liquidation,
                denom: NATIVE_CURRENCY.symbol,
                decimals: liquidationDecimals,
                fontSize: 16
              }"
            />
            <BigNumber
              :loading="loading"
              :label="$t('message.interest-due')"
              :label-tooltip="{ content: $t('message.repay-interest', { dueDate: interestDueDate }) }"
              :amount="{
                microAmount: interestDue,
                denom: lpn?.shortName ?? '',
                decimals: lpn?.decimal_digits ?? 0,
                fontSize: 16,
                class: interestDueStatus ? 'text-warning-100' : ''
              }"
            />
          </div>
          <div class="flex flex-col gap-4">
            <BigNumber
              :loading="loading"
              :label="$t('message.down-payment')"
              :label-tooltip="{ content: $t('message.downpayment-tooltip') }"
              :amount="{
                value: downPayment,
                denom: NATIVE_CURRENCY.symbol,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.impact-dex-fee')"
              :label-tooltip="{ content: $t('message.impact-dex-fee-tooltip') }"
              :amount="{
                value: fee,
                denom: NATIVE_CURRENCY.symbol,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.interest-fee')"
              :label-tooltip="{ content: $t('message.interest-fee-tooltip') }"
              :amount="{
                value: interest,
                denom: '%',
                isDenomPrefix: false,
                fontSize: 16
              }"
            />
          </div>
        </div>
      </div>
      <span class="border-b border-border-color md:block md:border-r" />
      <div class="flex flex-1 flex-col gap-4">
        <BigNumber
          :loading="loading"
          :loading-width="'120px'"
          :label="$t('message.unrealized-pnl')"
          :amount="{
            value: pnl.amount,
            denom: '$',
            class: pnl.status ? 'text-typography-success' : 'text-typography-error',
            fontSize: 24,
            animatedReveal: true,
            compact: mobile
          }"
          :pnl-status="{
            positive: pnl.status,
            value: `${pnl.status ? '+' : ''}${pnl.percent}%`,
            badge: {
              content: pnl.percent,
              base: false
            }
          }"
        />
        <div class="flex gap-8">
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1">
              {{ $t("message.stop-loss-price") }}
              <Tooltip :content="$t('message.stop-loss-price-tooltip')">
                <SvgIcon
                  name="help"
                  class="cursor-pointer transition duration-200 ease-in-out hover:fill-icon-secondary"
                  size="s"
                /> </Tooltip
            ></span>
            <template v-if="stopLoss">
              <span class="flex text-14 font-semibold text-typography-default">
                {{ stopLoss.amount }} {{ $t("message.per") }} {{ pricerPerAsset?.shortName }}
              </span>
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="stopLoss ? $t('message.edit') : $t('message.set-stop-loss')"
                severity="secondary"
                size="small"
                :disabled="loading"
                @click="onEditStopLoss"
              />
              <Button
                v-if="stopLoss"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
                :disabled="loading"
                :loading="loadingStopLoss"
                @click="onRemoveStopLoss"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1">
              {{ $t("message.take-profit-price") }}
              <Tooltip :content="$t('message.take-profit-price-tooltip')">
                <SvgIcon
                  name="help"
                  class="cursor-pointer transition duration-200 ease-in-out hover:fill-icon-secondary"
                  size="s"
                /> </Tooltip
            ></span>
            <template v-if="takeProfit">
              <span class="flex text-14 font-semibold text-typography-default">
                {{ takeProfit.amount }} {{ $t("message.per") }} {{ pricerPerAsset?.shortName }}
              </span>
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="takeProfit ? $t('message.edit') : $t('message.set-take-profit')"
                severity="secondary"
                size="small"
                :disabled="loading"
                @click="onEditTakeProfit"
              />
              <Button
                v-if="takeProfit"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
                :disabled="loading"
                :loading="loadingTakeProfit"
                @click="onRemoveTakeProfit"
              />
            </div>
          </div>
        </div>
        <hr class="border-t border-border-color" />
        <PnlOverTimeChart :lease="lease" />
      </div>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import { Button, SvgIcon, Tooltip, Widget } from "web-components";

import EmptyState from "@/common/components/EmptyState.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import PnlOverTimeChart from "./PnlOverTimeChart.vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { IntercomService } from "@/common/utils";
import { TEMPLATES } from "../common";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";
import { usePositionSummary } from "./usePositionSummary";

const props = defineProps<{
  lease?: LeaseInfo | null;
  displayData?: LeaseDisplayData | null;
  loading: boolean;
}>();

const {
  mobile,
  pnl,
  status,
  sizePrimary,
  sizeSecondary,
  pricerPerAsset,
  stopLoss,
  takeProfit,
  lpn,
  debt,
  downPayment,
  fee,
  openedPrice,
  openedPriceDecimals,
  interestDue,
  interestDueStatus,
  interest,
  liquidation,
  liquidationDecimals,
  interestDueDate,
  loadingStopLoss,
  loadingTakeProfit,
  onRemoveStopLoss,
  onRemoveTakeProfit,
  onEditStopLoss,
  onEditTakeProfit
} = usePositionSummary(props);
</script>
