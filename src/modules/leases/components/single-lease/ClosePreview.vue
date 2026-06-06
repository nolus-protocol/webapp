<template>
  <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
    <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
    <template v-if="lease">
      <template v-if="sliderValue == 0">
        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="list-sparkle"
            class="mt-0.5 shrink-0 fill-icon-secondary"
          />
          {{ $t("message.preview-input") }}
        </div>
      </template>

      <template v-if="sliderValue > 0 && sliderValue < midPosition && !coversFullDebt">
        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <p
            class="flex-1"
            :innerHTML="
              $t('message.preview-closed-paid-partuial-debt', {
                amount: paidDebt,
                price: priceUsd,
                asset: debtData.asset,
                fee: debtData.fee
              })
            "
          ></p>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="info"
            class="mt-0.5 shrink-0 fill-icon-secondary"
          />
          {{ $t("message.preview-closed-debt") }} {{ remaining }}
        </div>
      </template>

      <template v-if="sliderValue == midPosition || (coversFullDebt && sliderValue > 0 && sliderValue < midPosition)">
        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <p
            class="flex-1"
            :innerHTML="
              $t('message.preview-closed-paid-debt', {
                amount: debtData.debt,
                price: priceUsd,
                asset: debtData.asset,
                fee: debtData.fee
              })
            "
          ></p>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <div>
            <template v-if="shortReturnAtom"
              ><strong>{{ shortReturnAtom }}</strong> {{ $t("message.and") }}&nbsp;</template
            ><strong>{{ positionLeft }}</strong> {{ $t("message.preview-closed-rest") }}
          </div>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          {{ $t("message.preview-closed") }}
        </div>
      </template>

      <template v-if="sliderValue > midPosition && sliderValue < 100">
        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <p
            class="flex-1"
            :innerHTML="
              $t('message.preview-closed-paid-debt', {
                amount: debtData.debt,
                price: priceUsd,
                asset: debtData.asset,
                fee: debtData.fee
              })
            "
          ></p>
        </div>

        <!-- <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          {{ $t("message.preview-closed-paid") }}
          <strong>{{ payout }} {{ lpn }}</strong>
        </div> -->

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <div>
            <template v-if="shortReturnAtom"
              ><strong>{{ shortReturnAtom }}</strong> {{ $t("message.and") }}&nbsp;</template
            ><strong>{{ positionLeft }}</strong> {{ $t("message.preview-closed-rest") }}
          </div>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          {{ $t("message.preview-closed") }}
        </div>
      </template>

      <template v-if="sliderValue >= 100">
        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <p
            class="flex-1"
            :innerHTML="
              $t('message.preview-closed-paid-debt', {
                amount: debtData.debt,
                price: priceUsd,
                asset: debtData.asset,
                fee: debtData.fee
              })
            "
          ></p>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          <div>
            <strong>{{ payout }} {{ lpn }}</strong>
            {{ $t("message.preview-closed-rest") }}
          </div>
        </div>

        <div class="flex items-start gap-2 text-14">
          <SvgIcon
            name="check-solid"
            class="mt-0.5 shrink-0 fill-icon-success"
          />
          {{ $t("message.preview-closed") }}
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { SvgIcon } from "web-components";
import type { LeaseInfo } from "@/common/api";

interface DebtData {
  debt: string;
  price: string;
  asset: string;
  fee: string;
}

defineProps<{
  lease: LeaseInfo | null;
  sliderValue: number;
  midPosition: number;
  coversFullDebt: boolean;
  paidDebt: string;
  priceUsd: string;
  debtData: DebtData;
  remaining: string;
  shortReturnAtom: string | null;
  positionLeft: string;
  payout: string;
  lpn: string;
}>();
</script>
