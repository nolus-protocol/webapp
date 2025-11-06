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
import { Decimal } from "@cosmjs/math";

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
  if (loading.value) return;

  try {
    loading.value = true;

    if (!wallet.wallet) return;

    let validators = await getValidators();
    let division = STAKING.VALIDATORS_NUMBER;

    if (validators?.length > 0) {
      division = validators?.length;
    }

    const decimals = NATIVE_ASSET.decimal_digits;
    const amountDec = Decimal.fromUserInput(props.amount, 0);
    const totalAmount = BigInt(amountDec.atomics); // integer in base units

    const divisionBig = BigInt(division);
    const quotient = totalAmount / divisionBig;
    const remainder = totalAmount % divisionBig;

    validators = validators.sort((a: any, b: any) => {
      return Number(b.commission.commission_rates.rate) - Number(a.commission.commission_rates.rate);
    });

    const amounts: { value: bigint; validator: string }[] = [];

    for (const v of validators) {
      amounts.push({
        value: quotient,
        validator: v.operator_address
      });
    }

    if (amounts.length > 0) {
      amounts[0].value += remainder;
    }

    const delegations = amounts
      .filter((item) => item.value > 0n)
      .map((item) => ({
        srcValidator: props.src,
        dstValidator: item.validator,
        amount: coin(item.value.toString(), NATIVE_ASSET.denom)
      }));

    if (!delegations.length) {
      return;
    }

    const { txBytes } = await wallet.wallet.simulateRedelegateTx(delegations);
    await wallet.wallet.broadcastTx(txBytes as Uint8Array);

    await Promise.all([loadDelegated(), wallet.UPDATE_BALANCES()]);
    wallet.loadActivities();

    onShowToast({
      type: ToastType.success,
      message: i18n.t("message.delegate-successful")
    });
  } catch (err: any) {
    Logger.error(err);
  } finally {
    loading.value = false;
    onReload();
  }
}

async function getValidators() {
  const delegatorValidators = (await NetworkUtils.loadDelegatorValidators()).filter((e) => !e.jailed);
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
