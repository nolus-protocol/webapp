<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="modal-form"
  >
    <!-- Input Area -->
    <div class="modal-send-receive-input-area background">
      <div class="block text-left">
        <div class="mt-[20px] block">
          <Picker
            :default-option="networks[0]"
            :options="networks"
            :label="$t('message.network')"
            :value="modelValue.network"
            @update-selected="onUpdateCurrency"
          />
        </div>

        <div class="mt-[20px] block">
          <CurrencyField
            id="amount"
            :currency-options="modelValue.currentBalance"
            :disabled-currency-picker="disablePickerDialog"
            :error-msg="modelValue.amountErrorMsg"
            :is-error="modelValue.amountErrorMsg !== ''"
            :option="modelValue.selectedCurrency"
            :value="modelValue.amount"
            :name="$t('message.amount')"
            :label="$t('message.amount-field')"
            @input="handleAmountChange($event)"
            @update-currency="(event) => (modelValue.selectedCurrency = event)"
            :balance="formatCurrentBalance(modelValue.selectedCurrency)"
            :total="modelValue.selectedCurrency.balance"
          />
        </div>
        <div v-if="modelValue.network.native">
          <InputField
            :error-msg="modelValue.receiverErrorMsg"
            :is-error="modelValue.receiverErrorMsg !== ''"
            :value="modelValue.receiverAddress"
            :label="$t('message.recipient')"
            id="sendTo"
            name="sendTo"
            type="text"
            @input="(event) => (modelValue.receiverAddress = event.target.value)"
          />
        </div>

        <div v-else>
          <p class="nls-font-500 m-0 mb-[6px] mt-2 text-14 text-primary">
            {{ $t("message.recipient") }}
          </p>
          <p class="nls-font-700 m-0 break-all text-14 text-primary">
            {{ WalletUtils.isAuth() ? modelValue.wallet : $t("message.connect-wallet-label") }}
          </p>
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="modal-send-receive-actions background flex-col">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.send") }}
      </button>
      <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ modelValue.network.estimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { SendComponentProps } from "./types";
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Network } from "@/common/types";

import Picker from "@/common/components/Picker.vue";
import InputField from "@/common/components/InputField.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";

import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, EnvNetworkUtils, WalletUtils } from "@/common/utils";
import { computed, ref, onMounted } from "vue";
import { NETWORKS_DATA } from "@/networks";
import { useApplicationStore } from "@/common/stores/application";
import { LPN_NETWORK, NATIVE_NETWORK, ProtocolsConfig } from "@/config/global";
import { AppUtils } from "@/common/utils";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SendComponentProps>,
    default: {} as object
  }
});

const app = useApplicationStore();
const disablePickerDialog = ref(false);

const networks = computed(() => {
  const n: string[] = [];
  if ((props.modelValue?.dialogSelectedCurrency.length as number) > 0) {
    const [ckey, protocol]: string[] = props.modelValue!.dialogSelectedCurrency.split("@");

    let lpn = app.lpn?.find((item) => {
      return item.key == props.modelValue!.dialogSelectedCurrency;
    });

    n.push(NATIVE_NETWORK.key);

    if (ckey == NATIVE_NETWORK.symbol) {
      n.push(app.networksData?.protocols[AppUtils.getProtocols().neutron].DexNetwork as string);
    }

    if (lpn) {
      const [key, protocol] = lpn.key!.split("@");
      n.push(app.networksData?.protocols[protocol].DexNetwork as string);

      for (const ntw of LPN_NETWORK) {
        n.push(ntw);
      }
    } else {
      for (const key in app.networks ?? {}) {
        if (app.networks?.[key][ckey] && !ProtocolsConfig[protocol].ignoreNetowrk.includes(key)) {
          n.push(key);
        }
      }
    }
    return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list.filter((item) => n.includes(item.key));
  }

  return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list;
});

defineEmits(["update:modelValue.selectedCurrency"]);

onMounted(() => {
  if ((props.modelValue?.dialogSelectedCurrency.length as number) > 0) {
    disablePickerDialog.value = true;
  }
});

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = AssetUtils.getCurrencyByDenom(props.modelValue.selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.decimal_digits
    ).toString();
  }
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function onUpdateCurrency(event: Network) {
  props.modelValue.network = event;
  if (!event.native) {
    props.modelValue.receiverAddress = props.modelValue.wallet as string;
  } else {
    props.modelValue.receiverAddress = "";
  }
}
</script>
