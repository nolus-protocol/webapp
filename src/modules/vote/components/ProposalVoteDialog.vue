<template>
  <DialogHeader :headerList="[$t('message.vote')]">
    <div class="overflow-auto w-full md:max-h-[70vh] text-primary p-10 custom-scroll">
      <h1>&#35;{{ proposal.id }} {{ proposal.title }}</h1>
      <template v-if="!!Number(delegatedTokensAmount.amount)">
        <div class="flex flex-col gap-4">
          <button class="btn btn-secondary btn-large-primary">
            {{ $t('message.yes') }}
          </button>
          <button class="btn btn-secondary btn-large-primary">
            {{ $t('message.no') }}
          </button>

          <div class="flex gap-4">
            <button class="btn btn-secondary btn-large-secondary w-full">
              {{ $t('message.abstained') }}
            </button>
            <button class="btn btn-secondary btn-large-secondary w-full">
              {{ $t('message.veto') }}
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <WarningBox :isWarning="true" class="mb-6">
          <template v-slot:icon>
            <img class="block mx-auto my-0 w-10 h-7" src="@/assets/icons/information-circle.svg" />
          </template>
          <template v-slot:content>
            <span class="text-primary">
              {{ $t('message.voting-warning') }}
            </span>
          </template>
        </WarningBox>
        <button class="btn btn-secondary btn-large-primary" @click="onDelegateClick">
          {{ $t('message.delegate') }}
        </button>
      </template>
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import { inject, onMounted, type PropType, ref } from 'vue'
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import WarningBox from '@/components/modals/templates/WarningBox.vue'
import { useWalletStore, WalletActionTypes } from '@/stores/wallet'
import { Dec } from '@keplr-wallet/unit'
import { type Coin, coin } from '@cosmjs/amino'
import { NATIVE_ASSET } from '@/config/env'
import router from '@/router'

defineProps({
  proposal: {
    type: Object as PropType<{ title: string; id: string }>,
    required: true
  }
})

const wallet = useWalletStore()
const delegatedTokensAmount = ref({} as Coin)

onMounted(async () => {
  await loadDelegated()
})

async function loadDelegated() {
  const delegations = await wallet[WalletActionTypes.LOAD_DELEGATIONS]()
  let decimalDelegated = new Dec(0)

  for (const item of delegations) {
    const d = new Dec(item.balance.amount)
    decimalDelegated = decimalDelegated.add(d)
  }

  delegatedTokensAmount.value = coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom)
}

const openDialog = inject('openDialog', () => {})

const onDelegateClick = async () => {
  const url = `earn#delegate`
  await router.push(url)
  if (url.includes('#')) {
    openDialog()
  }
}
</script>

<style lang="scss" scoped>
h1 {
  text-align: left;
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 24px;
}
</style>
