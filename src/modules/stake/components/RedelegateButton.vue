<template>
  <div class="flex items-center gap-1">
    <Label
      :value="loading ? $t('message.redelagate') : $t('message.jailed')"
      variant="error"
      :tooltip="$t('message.jailed-tooltip')"
    />
    <SvgIcon
      @click="delegate"
      class="cursor-pointer"
      name="refresh"
    />
  </div>
</template>

<script lang="ts" setup>
import { useWalletStore } from "@/common/stores/wallet";
import { Logger, NetworkUtils, Utils } from "@/common/utils";
import { NATIVE_ASSET, STAKING } from "@/config/global";
import { inject, ref } from "vue";
import { Label, SvgIcon, ToastType } from "web-components";
import { coin } from "@cosmjs/stargate";
import { useI18n } from "vue-i18n";

const loading = ref(false);
const wallet = useWalletStore();
const i18n = useI18n();

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const onReload = inject("onReload", () => {});

const props = defineProps<{
  src: string;
  amount: string;
}>();

async function delegate() {
  if (loading.value) {
    return;
  }
  try {
    loading.value = true;

    if (wallet.wallet) {
      let validators = await getValidators();
      let division = STAKING.VALIDATORS_NUMBER;

      if (validators?.length > 0) {
        division = validators?.length;
      }

      const data = coin(props.amount, NATIVE_ASSET.denom);
      const amount = Number(data.amount.toString());
      const quotient = Math.floor(amount / division);
      const remainder = amount % division;
      const amounts = [];

      validators = validators.sort((a: any, b: any) => {
        return Number(b.commission.commission_rates.rate) - Number(a.commission.commission_rates.rate);
      });

      for (const v of validators) {
        amounts.push({
          value: quotient,
          validator: v.operator_address
        });
      }

      amounts[0].value += remainder;

      const delegations = amounts.map((item) => {
        return {
          srcValidator: props.src,
          dstValidator: item.validator,
          amount: coin(item.value, data.denom)
        };
      });
      console.log(delegations);
      const { txHash, txBytes, usedFee } = await wallet.wallet.simulateRedelegateTx(delegations);

      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      await Promise.all([loadDelegated(), wallet.UPDATE_BALANCES()]);
      wallet.loadActivities();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.delegate-successful")
      });
    }
  } catch (err: Error | any) {
    Logger.error(err);
  } finally {
    loading.value = false;
    onReload();
  }
}

async function getValidators() {
  const delegatorValidators = await NetworkUtils.loadDelegatorValidators();

  if (delegatorValidators.length > 0) {
    return delegatorValidators;
  }

  let validators = await NetworkUtils.loadValidators();
  let loadedValidators = [];
  if (validators.length > STAKING.SLICE) {
    validators = validators
      .slice(STAKING.SLICE)
      .filter((item: any) => {
        const date = new Date(item.unbonding_time);
        const time = Date.now() - date.getTime();

        if (time > STAKING.SLASHED_DAYS && !item.jailed) {
          return true;
        }

        return false;
      })
      .filter((item: any) => {
        const commission = Number(item.commission.commission_rates.rate);
        if (commission <= STAKING.PERCENT) {
          return true;
        }
        return false;
      });
  }

  for (let i = 0; i < STAKING.VALIDATORS_NUMBER; i++) {
    const index = Utils.getRandomInt(0, validators.length);
    loadedValidators.push(validators[index]);
    validators.splice(index, 1);
  }

  return loadedValidators;
}

function loadDelegated(): any {
  throw new Error("Function not implemented.");
}
</script>
