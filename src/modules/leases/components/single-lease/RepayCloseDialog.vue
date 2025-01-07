<template>
  <Dialog
    ref="dialog"
    :title="$t(`message.${route.params.dialog}`)"
    showClose
    @close-dialog="router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}`)"
  >
    <template v-slot:content>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-4 px-6 py-4">
        <AdvancedFormControl
          id="repay-close"
          :currencyOptions="assets"
          labelAdvanced
          :balanceLabel="$t('message.balance')"
          :selectedCurrencyOption="assets[0]"
          placeholder="0"
          calculatedBalance="$0"
          @on-selected-currency="(option) => {}"
          @input="() => {}"
        >
          <template v-slot:label>
            <div class="flex items-center gap-1">
              Amount in
              <span class="flex items-center gap-1 font-normal"
                ><img :src="`${iconsExternalUrl}/osmosis-nls.svg`" /> NLS</span
              >
            </div>
          </template>
        </AdvancedFormControl>
        <div class="px-4 py-3">
          <Slider
            :min-position="25"
            :max-position="150"
            :positions="5"
            v-on:ondrag="() => ({})"
            v-on:drag="() => ({})"
          />
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
        <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
        <div class="flex items-center gap-2 text-14">
          <SvgIcon
            name="list-sparkle"
            class="fill-icon-secondary"
          />
          <span class="text-typography-default">{{ $t("message.preview-input") }}</span>
        </div>
      </div>
      <hr class="border-border-color" />
      <div class="flex justify-end px-6 py-4">
        <Button
          :label="$t('message.show-transaction-details')"
          severity="tertiary"
          icon="plus"
          iconPosition="left"
          size="small"
          class="text-icon-default"
        />
      </div>
      <hr class="border-border-color" />
      <div class="flex flex-col gap-2 p-6">
        <Button
          size="large"
          severity="primary"
          :label="$t(`message.${route.params.dialog}-btn-label`)"
        />
        <p class="text-center text-12 text-typography-secondary">{{ $t("message.estimate-time") }} ~20sec</p>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AdvancedFormControl, Button, Dialog, iconsExternalUrl, Slider, SvgIcon } from "web-components";

import { RouteNames } from "@/router";

const route = useRoute();
const router = useRouter();
const dialog = ref<typeof Dialog | null>(null);

const assets = [
  {
    value: "nls",
    label: "Nolus",
    icon: `${iconsExternalUrl}/osmosis-nls.svg`,
    balance: { value: "555.234", ticker: "NLS" }
  }
];

onMounted(() => {
  dialog?.value?.show();
});
</script>

<style scoped lang=""></style>
