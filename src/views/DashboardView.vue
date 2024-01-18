<template>
  <div class="mt-[25px]">
    <!-- <button
      class="text-primary"
      v-if="AppUtils.isDev()"
      @click="openModal(DASHBOARD_ACTIONS.RECEIVEV2)"
    >
      Receive v2 / Send v2
    </button> -->
    <BannerComponent />
    <div class="col-span-12 px-4 lg:px-0">
      <!-- Header -->
      <!-- <div class="table-header lg:flex block flex-wrap items-center justify-between lg:px-0 px-2">
        <div class="left">
          <h1 class="text-20 nls-font-700 text-primary m-0 pb-3 lg:pb-0">
            {{ $t("message.assets") }}
          </h1>
        </div>

        <div class="right md:mt-0 inline-flex justify-end">
          <button
            class="btn btn-primary btn-large-primary"
            @click="openModal(DASHBOARD_ACTIONS.RECEIVE)"
          >
            {{ $t("message.send-receive") }}
          </button>

          <button class="btn btn-secondary btn-large-secondary ml-4 hidden">
            {{ $t("message.buy-tokens") }}
          </button>
        </div>
      </div> -->
      <!-- Wallet -->
      <Transition :name="animate">
        <!-- v-if="isTotalBalancePositive" -->
        <div
          class="flex flex-col balance-box justify-start background mt-6 shadow-box radius-medium p-4 lg:p-6 lg:items-baseline outline"
        >
          <p class="nls-font-500 text-16 text-primary mb-1.5 md:mb-6">
            {{ $t('message.portfolio-title') }}
          </p>
          <div class="w-full border-standart border-b flex-col flex gap-8 pb-4 mb-4 md:mb-6 md:pb-6 md:flex-row">
            <div
              v-show="!totalBalance.isZero()"
              class="hidden md:block"
            >
              <!-- Chart Component here -->
              <DashboardDaughnutChart ref="statChart" />
            </div>


            <div class="flex flex-col">
              <div>
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.portfolio-value') }}
                </p>
                <CurrencyComponent
                  :amount="totalBalance.toString()"
                  :decimals="2"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="40"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-700 text-primary"
                />
              </div>

              <div class="">
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.total-equity') }}
                </p>

                <CurrencyComponent
                  :amount="totalEquity.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>
            </div>
          </div>

          <div class="flex w-full lg:mt-0 pb-2 flex-col md:flex-row">
            <div class="flex">
              <div class="pr-8 lg:pr-0">
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.active-leases') }}
                </p>

                <CurrencyComponent
                  :amount="activeLeases.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>

              <div class="lg:pl-8">
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.outstanding-loan') }}
                </p>

                <CurrencyComponent
                  :amount="debt.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>
            </div>

            <div
              class="pt-4 pb-4 mb-4 border-standart border-b md:pt-0 md:pl-8 md:pr-8 md:border-b-0 md:border-r md:pb-0 md:mb-0"
            >
              <p class="nls-font-500 text-12 text-dark-grey">
                {{ $t('message.positions-pnL') }}
              </p>

              <CurrencyComponent
                :amount="pnl.abs().toString()"
                :class="pnl.isZero()
                    ? 'text-primary'
                    : pnl.isPositive()
                      ? '!text-[#1AB171]'
                      : 'text-[#E42929]'
                  "
                :denom="`${pnl.isZero() ? '' : pnl.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol
                  }`"
                :fontSize="20"
                :fontSizeSmall="14"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="nls-font-500"
              />
            </div>

            <div class="flex">
              <div class="pl-0 pr-8 md:pl-8 md:pr-0">
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.supplied-and-staked') }}
                </p>

                <CurrencyComponent
                  :amount="earnings.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>

              <div class="md:pl-8">
                <p class="nls-font-500 text-12 text-dark-grey">
                  {{ $t('message.rewards') }}
                </p>
                <CurrencyComponent
                  :amount="rewards.abs().toString()"
                  :class="rewards.isZero()
                      ? 'text-primary'
                      : rewards.isPositive()
                        ? '!text-[#1AB171]'
                        : 'text-[#E42929]'
                    "
                  :denom="`${rewards.isZero() ? '' : rewards.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol
                    }`"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500"
                />
              </div>
            </div>

            <!-- HIDDEN ON DESKTOP -->
          </div>
        </div>
      </Transition>

      <!-- Existing Assets -->
      <div
        :class="{ 'async-loader': isAssetsLoading }"
        class="block background mt-6 border-standart shadow-box radius-medium outline"
      >
        <!-- Top -->
        <div class="flex flex-wrap items-baseline justify-between px-3 md:px-4 pt-6">
          <div class="left w-1/3">
            <p class="text-16 nls-font-500 dark-text pl-0 md:pl-2">
              {{ $t('message.available-assets') }}
            </p>
          </div>
          <div class="right w-2/3 mt-0 inline-flex justify-end">
            <div class="relative block checkbox-container">
              <!-- <div class="flex items-center w-full justify-end">
                <input
                  id="show-small-balances"
                  v-model="state.showSmallBalances"
                  aria-describedby="show-small-balances"
                  name="show-small-balances"
                  type="checkbox"
                  @change="setSmallBalancesState(state.showSmallBalances)"
                />
                <label
                  class="dark-text"
                  for="show-small-balances"
                >{{
                  $t("message.show-small-balances")
                }}</label>
              </div> -->
            </div>
          </div>
        </div>

        <!-- Assets -->
        <div class="block mt-6 md:mt-[25px]">
          <!-- Assets Header -->
          <div class="grid grid-cols-4 md:grid-cols-5 gap-6 border-b border-standart pb-3 px-3 md:px-4">
            <div class="nls-font-500 text-12 text-left text-dark-grey text-upper md:col-span-1 col-span-2">
              {{ $t('message.assets') }}
            </div>

            <div class="nls-font-500 text-dark-grey text-12 text-right text-upper">
              {{ $t('message.balance') }}
            </div>

            <div
              class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
            >
              <span class="inline-block">{{ $t('message.yield') }}</span>
              <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
            </div>

            <div
              class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
            >
              <span class="inline-block">{{ $t('message.lease-up-to') }}</span>
              <TooltipComponent :content="$t('message.lease-up-to-tooltip')" />
            </div>

            <div
              class="md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper">
              <span class="inline-block">{{ $t('message.receive/send') }}</span>
            </div>
          </div>

          <!-- Assets Container -->
          <div
            :class="{ 'animate-pulse': loading }"
            class="block lg:mb-0"
            role="status"
          >
            <template v-if="loading">
              <div
                v-for="index in currenciesSize"
                :key="index"
                class="h-[67px] flex items-center justify-between asset-partial nolus-box relative border-b border-standart py-3 px-4 items-center justify-between"
              >
                <div class="w-[50%] md:w-auto">
                  <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                  <div class="h-1.5 bg-grey rounded-full w-24"></div>
                </div>
                <div class="flex flex-col items-end w-[50%] md:w-auto ml-8">
                  <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                  <div class="h-1.5 bg-grey rounded-full w-24"></div>
                </div>
                <div class="h-1.5 bg-grey rounded-full w-12 hidden md:flex"></div>
                <div class="h-1.5 bg-grey rounded-full w-12 hidden md:flex"></div>
              </div>
            </template>
            <template v-else>
              <TransitionGroup
                appear
                name="fade"
                tag="div"
              >
                <AssetPartial
                  v-for="(asset, index) in filteredAssets"
                  :key="`${asset.balance.denom}-${index}`"
                  :asset-info="getAssetInfo(asset.balance.denom)"
                  :assetBalance="asset.balance.denom == wallet.available.denom
                      ? wallet.available.amount.toString()
                      : asset.balance.amount.toString()
                    "
                  :changeDirection="index % 2 === 0"
                  :denom="asset.balance.denom"
                  :earnings="DEFAULT_APR"
                  :openModal="openModal"
                  :price="getMarketPrice(asset.balance.denom)"
                  :sendReceiveOpen="sendReceiveOpen"
                />
              </TransitionGroup>
            </template>
          </div>

          <div class="flex justify-center pt-[8px] pb-[18px]">
            <button
              class="btn transfer btn-medium-secondary"
              @click="setCurrency()"
            >
              {{
                state.showSmallBalances
                ? $t('message.hide-small-balances')
                : $t('message.show-small-balances')
              }}
            </button>
          </div>
        </div>
      </div>

      <!-- Vested Assets -->
      <div
        v-if="vestedTokens.length > 0"
        class="block background mt-6 shadow-box radius-medium outline"
      >
        <!-- Top -->
        <div class="flex flex-wrap items-baseline justify-between px-4 pt-6">
          <div class="left w-1/2">
            <p class="text-16 nls-font-500 dark-text">
              {{ $t('message.vested') }}
            </p>
          </div>
        </div>

        <!-- Assets -->
        <div class="block mt-6 md:mt-[25px]">
          <!-- Assets Header -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-6 border-b border-standart pb-3 px-6">
            <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
              {{ $t('message.assets') }}
            </div>

            <div class="hidden md:inline-flex items-center nls-font-500 text-12 text-right text-dark-grey text-upper">
              <span class="inline-block">{{ $t('message.release') }}</span>
            </div>

            <div class="nls-font-500 text-dark-grey text-12 text-right text-upper">
              {{ $t('message.balance') }}
            </div>
          </div>

          <!-- Assets Container -->
          <div class="block mb-6 lg:mb-0">
            <VestedAssetPartial
              v-for="(asset, index) in vestedTokens"
              :key="`${asset.amount.amount}-${index}`"
              :asset-balance="wallet.vestTokens.amount.toString()"
              :asset-info="getAssetInfo(asset.amount.denom)"
              :denom="asset.amount.denom"
              :end-time="asset.endTime"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal
    v-if="state.showModal"
    :route="state.modalAction"
    @close-modal="state.showModal = false"
  >
    <component
      :is="modalOptions[state.modalAction]"
      :dialogSelectedCurrency="state.dialogSelectedCurrency"
      :selectedAsset="state.selectedAsset"
    />
  </Modal>

  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import AssetPartial from '@/components/AssetPartial.vue'
import TooltipComponent from '@/components/TooltipComponent.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue'
import SendReceiveDialog from '@/components/modals/SendReceiveDialog.vue'
import SendReceiveV2Dialog from '@/components/modals/SendReceiveV2Dialog.vue'

import LeaseDialog from '@/components/modals/LeaseDialog.vue'
import VestedAssetPartial from '@/components/VestedAssetPartial.vue'
import CurrencyComponent from '@/components/CurrencyComponent.vue'
import BannerComponent from '@/components/BannerComponent.vue'

import type { LeaseData } from '@/types'
import type { AssetBalance } from '@/stores/wallet/state'
import { computed, onMounted, onUnmounted, provide, ref, Transition, watch } from 'vue'
import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { ChainConstants, CurrencyUtils, NolusClient } from '@nolus/nolusjs'
import { DASHBOARD_ACTIONS } from '@/types/DashboardActions'
import { useLeases } from '@/composables'
import { useWalletStore, WalletActionTypes } from '@/stores/wallet'
import { useOracleStore } from '@/stores/oracle'
import { useApplicationStore } from '@/stores/application'

import {
  calculateAditionalDebt,
  CoinGecko,
  DEFAULT_APR,
  IGNORE_TRANSFER_ASSETS,
  LPN_DECIMALS,
  NATIVE_ASSET,
  NATIVE_CURRENCY,
  PERCENT,
  PERMILLE
} from '@/config/env'
import { storeToRefs } from 'pinia'
import { CURRENCY_VIEW_TYPES } from '@/types/CurrencyViewType'
import { AssetUtils, WalletManager } from '@/utils'
import { Lpp } from '@nolus/nolusjs/build/contracts'
import { AppUtils } from '@/utils/AppUtils'
import { ASSETS } from '@/config/assetsInfo'
import { Tendermint34Client } from '@cosmjs/tendermint-rpc'
import { toUtf8 } from '@cosmjs/encoding'
import { QuerySmartContractStateRequest } from 'cosmjs-types/cosmwasm/wasm/v1/query'
import { useAdminStore } from '@/stores/admin'
import DashboardDaughnutChart from '@/components/DashboardDaughnutChart.vue'

const modalOptions = {
  [DASHBOARD_ACTIONS.SEND]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.RECEIVE]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.SUPPLY]: SupplyWithdrawDialog,
  [DASHBOARD_ACTIONS.LEASE]: LeaseDialog,
  [DASHBOARD_ACTIONS.SENDV2]: SendReceiveV2Dialog,
  [DASHBOARD_ACTIONS.RECEIVEV2]: SendReceiveV2Dialog
}

const smallBalancesStateKey = 'smallBalancesState'
const statChart = ref<typeof DashboardDaughnutChart>()

const wallet = useWalletStore()
const oracle = useOracleStore()
const app = useApplicationStore()
const admin = useAdminStore()

const walletRef = storeToRefs(wallet)
const oracleRef = storeToRefs(oracle)

const isAssetsLoading = ref(wallet.balances.length == 0)
const showSkeleton = ref(wallet.balances.length == 0)

const showErrorDialog = ref(false)
const loaded = wallet.balances.length > 0 && Object.keys(oracle.prices).length > 0
const animate = ref(loaded ? '' : 'fade')
const errorMessage = ref('')
const earnings = ref(new Dec(0))
const debt = ref(new Dec(0))
const activeLeases = ref(new Dec(0))
const pnl = ref(new Dec(0))
const rewards = ref(new Dec(0))

let timeout: NodeJS.Timeout

const state = ref({
  showSmallBalances: localStorage.getItem(smallBalancesStateKey) ? false : true,
  showModal: false,
  modalAction: DASHBOARD_ACTIONS.SEND,
  selectedAsset: '',
  dialogSelectedCurrency: '',
  availableAssets: new Dec(0)
})

const vestedTokens = ref([] as { endTime: string; amount: { amount: string; denom: string } }[])

const totalEquity = computed(() => {
  return totalBalance.value.sub(debt.value as Dec)
})

const filteredAssets = computed(() => {
  const b = wallet.balances.filter((currency) => {
    const c = wallet.getCurrencyInfo(currency.balance.denom)
    if (IGNORE_TRANSFER_ASSETS.includes(c.ticker as string)) {
      return false
    }
    return true
  })
  const balances = state.value.showSmallBalances ? b : filterSmallBalances(b as AssetBalance[])
  return balances.sort((a, b) => {
    const aInfo = wallet.getCurrencyInfo(a.balance.denom)
    const aAssetBalance = CurrencyUtils.calculateBalance(
      getMarketPrice(a.balance.denom),
      new Coin(a.balance.denom, a.balance.amount.toString()),
      aInfo.coinDecimals as number
    ).toDec()

    const bInfo = wallet.getCurrencyInfo(b.balance.denom)
    const bAssetBalance = CurrencyUtils.calculateBalance(
      getMarketPrice(b.balance.denom),
      new Coin(b.balance.denom, b.balance.amount.toString()),
      bInfo.coinDecimals as number
    ).toDec()

    return Number(bAssetBalance.sub(aAssetBalance).toString(8))
  })
})

const loading = computed(() => showSkeleton.value || wallet.balances.length == 0)
const currenciesSize = computed(() => Object.keys(app.currenciesData ?? {}).length)
const { leases, getLeases } = useLeases((error: Error | any) => { })

provide('getLeases', getLeases)

onMounted(() => {
  getVestedTokens()
  availableAssets()
  loadSuppliedAndStaked()
  wallet[WalletActionTypes.LOAD_STAKED_TOKENS]()
  wallet[WalletActionTypes.LOAD_SUPPLIED_AMOUNT]()
  if (showSkeleton.value) {
    timeout = setTimeout(() => {
      showSkeleton.value = false
    }, 400)
  }
})

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout)
  }
})

watch(walletRef.wallet, async () => {
  try {
    await Promise.all([
      getVestedTokens(),
      availableAssets(),
      loadSuppliedAndStaked(),
      wallet[WalletActionTypes.LOAD_STAKED_TOKENS](),
      wallet[WalletActionTypes.LOAD_SUPPLIED_AMOUNT]()
    ])
  } catch (e) {
    console.log(e)
  }
})

watch(
  () => [oracle.prices, wallet.wallet],
  (next, prev) => {
    const [pr, w]: any = next
    if (w?.address as string) {
      loadRewards()
    }
  },
  { immediate: true }
)

watch(
  () => wallet.wallet,
  (next, prev) => {
    if (prev?.address != null) {
      getLeases()
    }
  }
)

watch(
  () => leases.value,
  () => {
    loadLeases()
  }
)

watch(walletRef.balances, () => {
  availableAssets()
  loadSuppliedAndStaked()
  getVestedTokens()
})

watch(oracleRef.prices, () => {
  availableAssets()
  loadSuppliedAndStaked()
})

const onClickTryAgain = async () => {
  getVestedTokens()
}

const getVestedTokens = async () => {
  vestedTokens.value = await wallet[WalletActionTypes.LOAD_VESTED_TOKENS]()
}

const totalBalance = computed(() => {
  let total = state.value.availableAssets
  total = total.add(activeLeases.value as Dec)
  total = total.add(earnings.value as Dec)

  return total
})

const availableAssets = () => {
  if (Object.keys(oracle.prices).length == 0) {
    return false
  }

  let totalAssets = new Dec(0)
  wallet.balances.forEach((asset) => {
    const { coinDecimals, coinDenom } = wallet.getCurrencyInfo(asset.balance.denom)

    const assetBalance = CurrencyUtils.calculateBalance(
      getMarketPrice(asset.balance.denom),
      new Coin(coinDenom, asset.balance.amount.toString()),
      coinDecimals
    )

    totalAssets = totalAssets.add(assetBalance.toDec())
  })

  state.value.availableAssets = totalAssets

  if (animate.value.length > 0 && totalAssets.gt(new Dec(0))) {
    setTimeout(() => {
      animate.value = ''
    }, 400)
  }
}

const loadSuppliedAndStaked = async () => {
  if (Object.keys(oracle.prices).length == 0) {
    return false
  }

  const supplied = async () => {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const promises = []
    const amount = new Dec(0)

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const lppClient = new Lpp(cosmWasmClient, admin.contracts[protocolKey].lpp)
        const lppConfig = await lppClient.getLppConfig()
        const lpnCoin = app.getCurrencySymbol(lppConfig.lpn_ticker, protocolKey)
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress()

        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ])

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount))
        amount.add(
          new Dec(depositBalance.balance, Number(lpnCoin!.decimal_digits)).mul(calculatedPrice)
        )
      }

      promises.push(fn())
    }

    await Promise.all(promises)

    return amount
  }

  const delegated = async () => {
    const delegations = await wallet[WalletActionTypes.LOAD_DELEGATIONS]()
    const nativeAsset = AssetUtils.getAssetInfo(NATIVE_ASSET.ticker)
    let v = new Dec(0)

    for (const item of delegations) {
      const p = AssetUtils.getPriceByDenom(item.balance.amount, nativeAsset.coinMinimalDenom)
      v = v.add(p)
    }

    return v
  }

  await Promise.all([supplied(), delegated()])
    .then(([a, b]) => {
      earnings.value = new Dec(0)
      earnings.value = earnings.value.add(a)
      earnings.value = earnings.value.add(b)
    })
    .catch((e) => console.log(e))
}

const filterSmallBalances = (balances: AssetBalance[]) => {
  return balances.filter((asset) => asset.balance.amount.gt(new Int('1')))
}

const openModal = (action: DASHBOARD_ACTIONS, denom = '') => {
  state.value.dialogSelectedCurrency = ''
  state.value.selectedAsset = denom
  state.value.modalAction = action
  state.value.showModal = true
}

const getAssetInfo = (denom: string) => {
  return wallet.getCurrencyInfo(denom)
}

const getMarketPrice = (denom: string) => {
  const price = oracle.prices?.[denom]?.amount ?? '0'
  return price
}

const setCurrency = () => {
  state.value.showSmallBalances = !state.value.showSmallBalances
  setSmallBalancesState(state.value.showSmallBalances)
}

const setSmallBalancesState = (event: boolean) => {
  if (!event) {
    localStorage.setItem(smallBalancesStateKey, 'false')
  } else {
    localStorage.removeItem(smallBalancesStateKey)
  }
}

const sendReceiveOpen = (currency: string) => {
  state.value.selectedAsset = ''
  state.value.dialogSelectedCurrency = currency
  state.value.modalAction = DASHBOARD_ACTIONS.RECEIVE
  state.value.showModal = true
}

const strToColor = (str: string) => {
  let hash = 0
  if (str.length === 0) return hash
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  let rgb = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 255
    rgb[i] = value
  }

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

const setChartData = async () => {
  const labels: string[] = []
  const colors: string[] = []
  const dataValue: string[] = []
  const assets: string[] = [];

  const balances = wallet.balances

  balances.filter((item) => {
    const currencyInfo = wallet.getCurrencyInfo(item.balance.denom)
    const coin = new Coin(item.balance.denom, item.balance.amount)
    const balance = CurrencyUtils.calculateBalance(
      getMarketPrice(item.balance.denom),
      coin,
      currencyInfo.coinDecimals
    )

    if (!balance.toDec().isZero()) {
      labels.push(currencyInfo.shortName)
      colors.push(`${strToColor(currencyInfo.shortName)}`)
      dataValue.push(balance.toDec().toString(4))
      assets.push(new Dec(item.balance.amount, currencyInfo.coinDecimals).toString(4));
    }

    return currencyInfo
  })
  statChart.value?.updateChart(labels, colors, dataValue, assets)
}

watch(
  () => [oracle.prices, wallet.balances, statChart.value?.chartElement.chart],
  () => {
    if (statChart.value?.chartElement.chart) {
      setChartData()
    }
  }, {

}
)

const loadLeases = async () => {
  try {
    const promises: Promise<void>[] = []
    let db = new Dec(0)
    let ls = new Dec(0)
    let pl = new Dec(0)

    for (const lease of leases.value) {
      if (lease.leaseStatus.opened) {
        const fn = async () => {
          const data = JSON.parse(localStorage.getItem(lease.leaseAddress) ?? '{}')
          if (
            data.downPayment &&
            data.downpaymentTicker &&
            data.price &&
            data.leasePositionTicker
          ) {
            return Promise.all([data, AppUtils.getOpenLeaseFee()])
          } else {
            return Promise.all([checkData(lease), AppUtils.getOpenLeaseFee()])
          }
        }

        promises.push(
          fn().then(([leaseData, downpaymentFee]) => {
            const data = lease.leaseStatus?.opened

            if (data) {
              const dasset = wallet.getCurrencyByTicker(data.amount.ticker)
              const dIbcDenom = wallet.getIbcDenomBySymbol(dasset!.symbol) as string
              const dDecimal = Number(dasset!.decimal_digits)
              const l = CurrencyUtils.calculateBalance(
                getMarketPrice(dIbcDenom),
                new Coin(dIbcDenom, data.amount.amount),
                dDecimal
              ).toDec()

              ls = ls.add(l)

              db = new Dec(data.principal_due.amount, LPN_DECIMALS)
                .add(new Dec(data.previous_margin_due.amount, LPN_DECIMALS))
                .add(new Dec(data.previous_interest_due.amount, LPN_DECIMALS))
                .add(new Dec(data.current_margin_due.amount, LPN_DECIMALS))
                .add(new Dec(data.current_interest_due.amount, LPN_DECIMALS))
                .add(new Dec(additionalInterest(lease).truncate(), LPN_DECIMALS))

              const amount = new Dec(data.principal_due.amount, LPN_DECIMALS)
                .add(new Dec(data.previous_margin_due.amount, LPN_DECIMALS))
                .add(new Dec(data.previous_interest_due.amount, LPN_DECIMALS))
                .add(new Dec(data.current_margin_due.amount, LPN_DECIMALS))
                .add(new Dec(data.current_interest_due.amount, LPN_DECIMALS))

              const totalAmount = new Dec((leaseData.downPayment as string) ?? '0').add(amount)
              const assetData = wallet.getCurrencyByTicker(data.amount.ticker)
              const assetAmount = new Dec(data.amount.amount, Number(assetData!.decimal_digits))
              const prevPrice = totalAmount.quo(assetAmount)

              const unitAsset = new Dec(data.amount.amount, Number(dDecimal))
              const currentPrice = new Dec(
                oracle.prices?.[dasset!.ibcData as string]?.amount ?? '0'
              )
              const prevAmount = unitAsset.mul(prevPrice)
              const currentAmount = unitAsset.mul(currentPrice)
              const dfee = new Dec(downpaymentFee[leaseData.downpaymentTicker]).mul(
                new Dec(leaseData.downPayment ?? 0)
              )
              const a = currentAmount.sub(prevAmount).add(dfee)
              pl = pl.add(a)
            }
          })
        )
      }
    }

    await Promise.all(promises)
    activeLeases.value = ls
    debt.value = db
    pnl.value = pl
  } catch (e) {
    console.log(e)
  }
}

const checkData = async (lease: LeaseData) => {
  const node = await AppUtils.getArchiveNodes()
  const req = await fetch(
    `${node.archive_node_rpc}/tx_search?query="wasm.lease_address='${lease.leaseAddress}'"&prove=true`
  )
  const data = await req.json()
  const item = data.result?.txs?.[0]

  if (item) {
    return getBlock(item?.height, lease)
  }
}

const getBlock = async (block: string, leaseInfo: LeaseData) => {
  try {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc
    const req = await fetch(`${url}/block?height=${block}`)
    const data = await req.json()
    const item = data.result?.block?.header?.time
    const ticker =
      leaseInfo?.leaseStatus?.opened?.amount?.ticker ?? leaseInfo?.leaseStatus?.paid?.amount?.ticker

    if (item && ticker) {
      const date = new Date(item)
      const [priceData, downpayment] = await Promise.all([
        fetchPrice(date, ticker),
        fetchDownPayment(Number(block), leaseInfo)
      ])
      const downpaymentPrice = await fetchDownPaymentPrice(
        date,
        downpayment.opening.downpayment.ticker
      )
      const asset = AssetUtils.getAssetInfo(downpayment.opening.downpayment.ticker)

      if (asset.coinDecimals == 0) {
        return false
      }

      const p = new Dec(downpaymentPrice)
      const d = new Dec(downpayment.opening.downpayment.amount, asset.coinDecimals)

      const dprice = d.mul(p)
      const res = {
        downpaymentTicker: downpayment.opening.downpayment.ticker,
        price: priceData.price,
        leasePositionTicker: ticker,
        downPayment: dprice.toString()
      }

      localStorage.setItem(leaseInfo.leaseAddress, JSON.stringify(res))
      return res
    }
  } catch (error) {
    console.log(error)
  }
}

const fetchPrice = async (time: Date, ticker: string) => {
  const asset = ASSETS[ticker as keyof typeof ASSETS]

  const date = `${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}`
  const req = await fetch(
    `${CoinGecko.url}/coins/${asset.coinGeckoId}/history?date=${date}&vs_currency=usd&localization=false&x_cg_pro_api_key=${CoinGecko.key}`
  )
  const data = await req.json()
  const price = data.market_data.current_price.usd
  return {
    price: price,
    leasePositionTicker: ticker
  }
}

const fetchDownPaymentPrice = async (time: Date, ticker: string) => {
  const asset = ASSETS[ticker as keyof typeof ASSETS]

  const date = `${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}`
  const req = await fetch(
    `${CoinGecko.url}/coins/${asset.coinGeckoId}/history?date=${date}&vs_currency=usd&localization=false&x_cg_pro_api_key=${CoinGecko.key}`
  )
  const data = await req.json()
  const price = data.market_data.current_price.usd

  return price
}

const fetchDownPayment = async (block: number, leaseInfo: LeaseData) => {
  const node = await AppUtils.getArchiveNodes()
  const client = await Tendermint34Client.connect(node.archive_node_rpc)

  const data = QuerySmartContractStateRequest.encode({
    address: leaseInfo.leaseAddress,
    queryData: toUtf8(JSON.stringify({}))
  }).finish()

  const query = {
    path: '/cosmwasm.wasm.v1.Query/SmartContractState',
    data,
    prove: true,
    height: block
  }

  const response = await client.abciQuery(query)
  const res = QuerySmartContractStateRequest.decode(response.value)
  return JSON.parse(res.address)
}

const additionalInterest = (leaseInfo: LeaseData) => {
  const data = leaseInfo.leaseStatus?.opened
  if (data) {
    const principal_due = new Dec(data.principal_due.amount)
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(
      new Dec(data.margin_interest_rate / PERCENT)
    )
    const debt = calculateAditionalDebt(principal_due, loanInterest)
    return debt
  }

  return new Dec(0)
}

async function loadRewards() {
  const [r, lpnRewards] = await Promise.all([
    wallet[WalletActionTypes.LOAD_DELEGATOR](),
    getRewards()
  ])

  const total = r?.total?.[0]
  let value = new Dec('0').add(lpnRewards)

  if (total) {
    value = new Dec(total.amount).add(value)
  }

  value = AssetUtils.getPriceByDenom(value.truncate().toString(), NATIVE_ASSET.denom)
  rewards.value = value
}

async function getRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const promises = []
    const rewards = new Dec(0)

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const contract = admin.contracts[protocolKey].lpp
        const lppClient = new Lpp(cosmWasmClient, contract)
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress()

        const lenderRewards = await lppClient.getLenderRewards(walletAddress)
        rewards.add(new Dec(lenderRewards.rewards.amount))
      }
      promises.push(fn())
    }

    await Promise.all(promises)

    return rewards
  } catch (e) {
    console.log(e)
  }

  return new Dec(0)
}
</script>
<style lang="scss" scoped>.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}</style>
