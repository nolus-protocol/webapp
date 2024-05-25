<template>
  <ConfirmRouteComponent
    v-if="showConfirmScreen"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHashes="txHashes"
    :step="step"
    :fee="fee!"
    :receiverAddress="walletStore.wallet?.address"
    :errorMsg="errorMsg"
    :txs="route!.txsRequired"
    :amount="`${swapAmount}`"
    :onSendClick="onSwap"
    :onBackClick="onConfirmBackClick"
    :onOkClick="() => closeModal()"
  />
  <template v-else>
    <div
      class="modal-send-receive-input-area custom-scroll overflow-auto"
      v-if="selectedNetwork.native"
    >
      <div class="block text-left">
        <div class="mt-[25px] block">
          <Picker
            :default-option="networks[0]"
            :options="networks"
            :label="$t('message.network')"
            @update-selected="onUpdateNetwork"
            :disable-input="true"
          />
        </div>

        <div class="mt-[18px] block">
          <p class="nls-font-500 m-0 mb-[6px] text-14 text-primary">
            {{ $t("message.address") }}
          </p>
          <p class="nls-font-700 m-0 break-all text-14 text-primary">
            {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t("message.connect-wallet-label") }}
          </p>
          <div class="mt-2 flex items-center justify-start">
            <button
              class="btn btn-secondary btn-medium-secondary btn-icon mr-2 flex"
              @click="onCopy()"
            >
              <DocumentDuplicateIcon class="icon h-4 w-4" />
              {{ copyText }}
            </button>
          </div>
        </div>

        <div class="mt-4 flex w-full justify-between text-[14px] text-light-blue">
          <p>{{ $t("message.estimate-time") }}:</p>
          <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
        </div>
      </div>
    </div>
    <template v-else>
      <form
        @submit.prevent="onSendClick"
        class="modal-form overflow-auto"
      >
        <!-- Input Area -->
        <div class="modal-send-receive-input-area background">
          <div class="block text-left">
            <div class="mt-[20px] block">
              <Picker
                :default-option="selectedNetwork"
                :options="networks"
                :label="$t('message.network')"
                :value="selectedNetwork"
                @update-selected="onUpdateNetwork"
                :disable-input="true"
              />
            </div>

            <div class="mt-[20px] block">
              <CurrencyField
                id="amount"
                :currency-options="networkCurrencies"
                :disabled-currency-picker="disablePicker || disablePickerDialog"
                :is-loading-picker="disablePicker"
                :error-msg="amountErrorMsg"
                :is-error="amountErrorMsg !== ''"
                :option="selectedCurrency"
                :value="amount"
                :name="$t('message.amount')"
                :label="$t('message.amount-receive')"
                :total="new KeplrCoin(selectedCurrency.balance.denom, selectedCurrency.balance.amount)"
                :balance="formatCurrentBalance(selectedCurrency)"
                @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
                @input="handleAmountChange($event)"
              />
            </div>

            <div>
              <p class="nls-font-500 m-0 mb-[6px] mt-2 text-14 text-primary">
                {{ $t("message.recipient") }}
              </p>
              <p class="nls-font-700 m-0 break-all text-14 text-primary">
                {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t("message.connect-wallet-label") }}
              </p>
            </div>
          </div>
        </div>
        <!-- Actions -->
        <div class="modal-send-receive-actions background flex-col">
          <button
            class="btn btn-primary btn-large-primary"
            :class="{ 'js-loading': isLoading }"
          >
            {{ $t("message.receive") }}
          </button>
          <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
            <p>{{ $t("message.estimate-time") }}:</p>
            <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
          </div>
        </div>
      </form>
    </template>
  </template>
</template>

<script setup lang="ts">
import Picker from "@/common/components/Picker.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";
import ConfirmRouteComponent from "../templates/ConfirmRouteComponent.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import { onUnmounted, ref, inject, watch, onMounted, nextTick, computed } from "vue";
import { DocumentDuplicateIcon } from "@heroicons/vue/24/solid";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWallet, walletOperation } from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { AppUtils } from "@/common/utils";
import { NATIVE_NETWORK } from "@/config/global";
import type { EvmNetwork } from "@/common/types/Network";
import { SwapStatus } from "../swap/types";

import { CONFIRM_STEP, TxType, type Network, type IObjectKeys, type SkipRouteConfigType } from "@/common/types";

import {
  AssetUtils,
  EnvNetworkUtils,
  Logger,
  SkipRouter,
  StringUtils,
  WalletManager,
  WalletUtils
} from "@/common/utils";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  onCopyClick: (wallet?: string) => void;
}

let client: Wallet;
let timeOut: NodeJS.Timeout;
let route: IObjectKeys | null;

const walletStore = useWalletStore();
const networks = ref<(Network | EvmNetwork)[]>([SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key]]);
const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const selectedNetwork = ref(networks.value[0]);
const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (b: boolean) => {});

const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const disablePickerDialog = ref(false);
const txHashes = ref<{ hash: string; status: SwapStatus }[]>([]);
const errorMsg = ref("");

const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const fee = ref<Coin>();
const isLoading = ref(false);
const closeModal = inject("onModalClose", () => () => {});
const wallet = ref(walletStore.wallet?.address);
let skipRouteConfig: SkipRouteConfigType | null;

onMounted(async () => {
  try {
    skipRouteConfig = await AppUtils.getSkipRouteConfig();
    const n = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list.filter((item) => {
      if (skipRouteConfig!.transfers[item.key]) {
        return true;
      }
      return false;
    }) as (Network | EvmNetwork)[];

    networks.value = [...networks.value, ...n];
  } catch (error) {
    Logger.error(error);
  }
});

onUnmounted(() => {
  clearTimeout(timeOut);
  if (client) {
    client.destroy();
  }
});

watch(
  () => [selectedCurrency.value, amount.value],
  () => {
    if (amount.value.length > 0) {
      validateAmount();
    }
  }
);

async function onUpdateNetwork(event: Network) {
  selectedNetwork.value = event;
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";

  if (!event.native) {
    if (client) {
      client.destroy();
    }

    disablePicker.value = true;
    const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];

    const currencies = [];
    const promises = [];
    const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[event.key].currencies;

    for (const c of data ?? []) {
      const currency = AssetUtils.getCurrencyByDenom(c.from);
      currency.balance = coin(0, c.to);
      currencies.push(currency);
    }

    const mappedCurrencies = currencies.map((item) => {
      return {
        balance: item.balance,
        shortName: item.shortName,
        ticker: item.ticker,
        name: item.shortName,
        icon: item.icon,
        decimal_digits: item.decimal_digits,
        symbol: item.symbol,
        native: item.native,
        from: item.ibcData
      };
    });

    selectedCurrency.value = mappedCurrencies?.[0];

    const networkData = network?.supportedNetworks[selectedNetwork.value.key];
    client = await WalletUtils.getWallet(event.key);
    const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
    wallet.value = baseWallet?.address as string;

    client = await WalletUtils.getWallet(event.key);

    if (WalletUtils.isAuth()) {
      for (const c of mappedCurrencies) {
        async function fn() {
          const balance = await client.getBalance(wallet.value as string, c.balance.denom);
          c.balance = balance;
        }
        promises.push(fn());
      }
    }

    await Promise.all(promises);

    networkCurrencies.value = mappedCurrencies;
    disablePicker.value = false;
  }
}

function onCopy() {
  copyText.value = i18n.t("message.copied");
  StringUtils.copyToClipboard(wallet.value ?? WalletManager.getWalletAddress());

  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t("message.copy");
  }, 2000);
}

function handleAmountChange(event: string) {
  amount.value = event;
}

async function validateInputs() {
  try {
    isLoading.value = true;
    const isValid = await validateAmount();

    if (isValid) {
      route = await getRoute();
      const network =
        NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
      const currency = AssetUtils.getCurrencyByTicker(network.ticker);
      fee.value = coin(network.fees.transfer_amount, currency.ibcData);
      showConfirmScreen.value = true;
    }
  } catch (error) {
    step.value = CONFIRM_STEP.ERROR;
    showConfirmScreen.value = true;
  } finally {
    isLoading.value = false;
  }
}

async function validateAmount() {
  amountErrorMsg.value = "";

  if (!WalletUtils.isAuth()) {
    return false;
  }

  if (!amount.value) {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
    return false;
  }

  const prefix =
    NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key]?.prefix;
  const decimals = selectedCurrency.value?.decimal_digits;

  if (prefix && decimals) {
    try {
      const balance = await client.getBalance(wallet.value as string, selectedCurrency.value.balance.denom);
      const walletBalance = Decimal.fromAtomics(balance.amount, decimals);
      const transferAmount = Decimal.fromUserInput(amount.value, decimals);
      const isGreaterThanWalletBalance = transferAmount.isGreaterThan(walletBalance);
      const isLowerThanOrEqualsToZero = transferAmount.isLessThanOrEqual(Decimal.fromUserInput("0", decimals));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        return false;
      }

      if (isGreaterThanWalletBalance) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-big");
        return false;
      }
    } catch (e) {
      Logger.error(e);
    }
  } else {
    amountErrorMsg.value = i18n.t("message.unexpected-error");
    return false;
  }

  return true;
}

async function onSendClick() {
  try {
    validateInputs();
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onSwap() {
  if (!route || !WalletUtils.isAuth() || amountErrorMsg.value.length > 0) {
    return false;
  }

  try {
    step.value = CONFIRM_STEP.PENDING;

    await walletOperation(async () => {
      try {
        // state.value.loading = true;
        // state.value.disabled = true;
        const wallets = await getWallets(route as IObjectKeys);
        const addresses: Record<string, string> = {};

        for (const key in wallets) {
          addresses[key] = wallets[key].address!;
        }

        await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet) => {
          const element = {
            hash: tx.txHash,
            status: SwapStatus.pending
          };

          const index = txHashes.value.length;
          txHashes.value.push(element);

          await wallet.broadcastTx(tx.txBytes as Uint8Array);
          txHashes.value[index].status = SwapStatus.success;
        });

        await walletStore.UPDATE_BALANCES();
        step.value = CONFIRM_STEP.SUCCESS;
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        errorMsg.value = (error as Error).toString();
        Logger.error(error);
      } finally {
        // state.value.loading = false;
        // state.value.disabled = false;
      }
    });
  } catch (e) {
    Logger.error(e);
  }
}

async function getWallets(route: IObjectKeys): Promise<{ [key: string]: BaseWallet }> {
  const native = walletStore.wallet.signer.chainId;
  const addrs = {
    [native]: walletStore.wallet
  };

  const chainToParse: { [key: string]: IObjectKeys } = {};
  const chains = (await SkipRouter.getChains()).filter((item) => {
    if (item.chainID == native) {
      return false;
    }
    return route!.chainIDs.includes(item.chainID);
  });

  for (const chain of chains) {
    for (const key in SUPPORTED_NETWORKS_DATA) {
      if (SUPPORTED_NETWORKS_DATA[key].value == chain.chainName) {
        chainToParse[key] = SUPPORTED_NETWORKS_DATA[key];
      }
    }
  }
  const promises = [];

  for (const chain in chainToParse) {
    const fn = async function () {
      const client = await WalletUtils.getWallet(chain);
      const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
      const networkData = network?.supportedNetworks[chain];
      const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
      addrs[baseWallet.getSigner().chainId] = baseWallet;
    };
    promises.push(fn());
  }

  await Promise.all(promises);

  return addrs;
}

async function getRoute() {
  try {
    const chaindId = await client.getChainId();
    const transferAmount = Decimal.fromUserInput(amount.value, selectedCurrency.value!.decimal_digits as number);

    const route = await SkipRouter.getRoute(
      selectedCurrency.value.from!,
      selectedCurrency.value.balance.denom,
      transferAmount.atomics,
      false,
      chaindId
    );

    return route;
  } catch (e) {
    Logger.error(e);
    return null;
  }
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
  amount.value = "";
  setDisable(false);
  nextTick(() => {
    errorMsg.value = "";
  });
  setShowDialogHeader(true);
  step.value = CONFIRM_STEP.CONFIRM;
  route = null;
}

function formatCurrentBalance(selectedCurrency: AssetBalance | undefined) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    if (selectedNetwork.value.native) {
      const asset = AssetUtils.getCurrencyByDenom(selectedCurrency.balance.denom);
      return CurrencyUtils.convertMinimalDenomToDenom(
        selectedCurrency.balance.amount.toString(),
        selectedCurrency.balance.denom,
        asset.ibcData,
        asset.decimal_digits
      ).toString();
    } else {
      if (selectedCurrency.decimal_digits != null && selectedCurrency.name != null) {
        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(),
          selectedCurrency.balance.denom,
          selectedCurrency.name as string,
          selectedCurrency.decimal_digits as number
        ).toString();
      }
    }
  }
}

// async function onTest() {
//   try {
//     const metamaskWallet = new MetaMaskWallet();
//     await metamaskWallet.connect({
//       chainId: `0x${(1).toString(16)}`,
//       chainName: "Ethereum",
//       rpcUrls: ["https://cloudflare-eth.com"],
//       blockExplorerUrls: ["https://etherscan.io"],
//       nativeCurrency: {
//         name: "Ethereum",
//         symbol: "ETH",
//         decimals: 18
//       }
//     });

//     const client = await SkipRouter.getClient();
//     const route = await SkipRouter.getRoute("ethereum-native", "unls", "5000000000000000");
//     const wallets = await getWallets(metamaskWallet, route);

//     await SkipRouter.transactionMetamask(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet) => {});
//   } catch (error) {
//     Logger.error(error);
//   }
// }

// async function getWallets(wallet: MetaMaskWallet, route: IObjectKeys): Promise<{ [key: string]: BaseWallet }> {
//   // const native = wallet.getSigner().chainId;
//   const native = walletStore.wallet.signer.chainId;

//   const addrs: { [key: string]: any } = {
//     ["1"]: wallet,
//     [native]: walletStore.wallet
//   };

//   const chainToParse: { [key: string]: IObjectKeys } = {};
//   const chains = (await SkipRouter.getChains()).filter((item) => {
//     if (item.chainID == "1") {
//       return false;
//     }
//     return route!.chainIDs.includes(item.chainID);
//   });

//   for (const chain of chains) {
//     for (const key in SUPPORTED_NETWORKS_DATA) {
//       if (SUPPORTED_NETWORKS_DATA[key].value == chain.chainName) {
//         chainToParse[key] = SUPPORTED_NETWORKS_DATA[key];
//       }
//     }
//   }
//   const promises = [];

//   for (const chain in chainToParse) {
//     const fn = async function () {
//       const client = await WalletUtils.getWallet(chain);
//       const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
//       const networkData = network?.supportedNetworks[chain];
//       const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
//       addrs[baseWallet.getSigner().chainId] = baseWallet;
//     };
//     promises.push(fn());
//   }

//   await Promise.all(promises);

//   return addrs;
// }

const swapAmount = computed(() => {
  return `${new Dec(amount.value).toString(selectedCurrency.value?.decimal_digits)} ${selectedCurrency.value?.shortName}`;
});
</script>
