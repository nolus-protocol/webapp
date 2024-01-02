<template>
  <template v-if="showConfirmScreen">
    <ConfirmComponent
      v-if="selectedNetwork.native"
      :selectedCurrency="selectedCurrency"
      :receiverAddress="receiverAddress"
      :password="password"
      :amount="amount"
      :memo="memo"
      :txType="$t(`message.${TxType.SEND}`) + ':'"
      :txHash="txHash"
      :step="step"
      :fee="fee"
      :onSendClick="onSendClick"
      :onBackClick="onConfirmBackClick"
      :onOkClick="onClickOkBtn"
      @passwordUpdate="(value) => (password = value)"
    />
    <template v-else>
      <ConfirmExternalComponent
        :selectedCurrency="selectedCurrency!"
        :receiverAddress="(walletStore.wallet?.address as string)"
        :password="password"
        :amount="amount"
        :memo="memo"
        :txType="$t(`message.${TxType.SEND}`) + ':'"
        :txHash="txHash"
        :step="step"
        :fee="fee"
        :networkCurrencies="networkCurrenciesObject"
        :networkKey="selectedNetwork.key"
        :networkSymbol="selectedNetwork.symbol"
        :onSendClick="onSendClick"
        :onBackClick="onConfirmBackClick"
        :onOkClick="onClickOkBtn"
        :networkType="networkType"
        @passwordUpdate="(value) => (password = value)"
      />
    </template>
  </template>

  <template v-else>

    <form
      v-if="selectedNetwork?.native"
      @submit.prevent="receive"
      class="modal-form "
    >
      <!-- Input Area -->
      <div class="modal-send-receive-input-area background">

        <div class="block text-left">

          <div class="block mt-[20px]">
            <Picker
              :default-option="selectedNetwork"
              :options="networks"
              :label="$t('message.network')"
              :value="selectedNetwork"
              @update-selected="onUpdateNetwork"
            />
          </div>

          <div class="block mt-[20px]">
            <CurrencyField
              id="amount"
              :currency-options="networkCurrencies"
              :disabled-currency-picker="disablePicker"
              :is-loading-picker="disablePicker"
              :error-msg="amountErrorMsg"
              :is-error="amountErrorMsg !== ''"
              :option="selectedCurrency"
              :value="amount"
              :name="$t('message.amount')"
              :label="$t('message.amount-receive')"
              :set-input-value="setAmount"
              @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
              @input="handleAmountChange($event)"
              :balance="formatCurrentBalance(selectedCurrency)"
              :total="total"
              :price="selectedCurrency.price"
            />
          </div>

          <div class="block mt-[20px]">
            <InputField
              :error-msg="receiverErrorMsg"
              :is-error="receiverErrorMsg !== ''"
              :value="receiverAddress"
              :label="$t('message.recipient')"
              id="sendTo"
              name="sendTo"
              type="text"
              @input="(event) => (receiverAddress = event.target.value)
                "
            />
          </div>

        </div>
      </div>
      <!-- Actions -->
      <div class="modal-send-receive-actions background flex-col">
        <button class="btn btn-primary btn-large-primary">
          {{ $t("message.send") }}
        </button>
        <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
          <p>{{ $t("message.estimate-time") }}:</p>
          <p>~{{ selectedNetwork.estimation.duration }} {{ $t(`message.${selectedNetwork.estimation.type}`) }}</p>
        </div>
      </div>
    </form>

    <template v-else>
      <form
        @submit.prevent="receive"
        class="modal-form overflow-auto"
      >
        <!-- Input Area -->
        <div class="modal-send-receive-input-area background">

          <div class="block text-left">

            <div class="block mt-[20px]">
              <Picker
                :default-option="selectedNetwork"
                :options="networks"
                :label="$t('message.network')"
                :value="selectedNetwork"
                @update-selected="onUpdateNetwork"
              />
            </div>

            <div class="block mt-[20px]">

              <CurrencyField
                id="amount"
                :currency-options="networkCurrencies"
                :disabled-currency-picker="disablePicker"
                :is-loading-picker="disablePicker"
                :error-msg="amountErrorMsg"
                :is-error="amountErrorMsg !== ''"
                :option="selectedCurrency"
                :value="amount"
                :name="$t('message.amount')"
                :label="$t('message.amount-receive')"
                :set-input-value="setAmount"
                @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
                @input="handleAmountChange($event)"
                :balance="formatCurrentBalance(selectedCurrency)"
                :total="total"
                :price="selectedCurrency.price"
              />
            </div>

            <div
              v-if="networkType == NetworkTypes.evm"
              class="block mt-[20px]"
            >
              <InputField
                :error-msg="receiverErrorMsg"
                :is-error="receiverErrorMsg !== ''"
                :value="receiverAddress"
                :label="$t('message.recipient')"
                id="sendTo"
                name="sendTo"
                type="text"
                @input="(event) => (receiverAddress = event.target.value)
                  "
              />
              <div class="flex justify-end mt-[8px]">
                <button
                  v-if="networkType == NetworkTypes.evm"
                  type="button"
                  class="btn btn-medium-secondary flex !px-[8px] !py-[4px] !text-[13px]"
                  @click="connectMetamask()"
                >
                  <img src="@/assets/icons/metamask.svg" />
                  <span class="ml-[6px]">{{ metamaskAddress ?? $t('message.connect') }}</span>
                </button>
              </div>
            </div>

            <div v-if="networkType == NetworkTypes.cosmos">
              <p class="text-14 nls-font-500 text-primary m-0 mb-[6px] mt-4">
                {{ $t("message.recipient") }}
              </p>
              <p class="text-14 text-primary nls-font-700 m-0 break-all">
                {{ WalletUtils.isAuth() ? toWallet : $t('message.connect-wallet-label') }}
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
          <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
            <p>{{ $t("message.estimate-time") }}:</p>
            <p>~{{ selectedNetwork.estimation.duration }} {{ $t(`message.${selectedNetwork.estimation.type}`) }}</p>
          </div>
        </div>
      </form>
    </template>
  </template>
</template>

<script setup lang="ts">
import Picker from "@/components/Picker.vue";
import CurrencyField from "@/components/CurrencyField.vue";
import ConfirmExternalComponent from "@/components/modals/templates/ConfirmExternalComponent.vue";
import InputField from "@/components/InputField.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import type { SquiRouterNetworkProp } from "@/types/NetworkConfig";
import type { AssetBalance } from "@/stores/wallet/state";
import type { CosmosChain, EvmChain } from "@0xsquid/squid-types";

import { Wallet, type BaseWallet } from "@/wallet";
import { NetworkTypes } from "@/types/NetworkConfig";

import { CONFIRM_STEP, TxType, type NetworkDataV2 } from "@/types";
import { ref, type PropType, inject, computed, onUnmounted, watch } from "vue";
import { ErrorCodes, GAS_FEES, IGNORE_TRANSFER_ASSETS, NATIVE_ASSET, SquidRouter } from "@/config/env";
import { useI18n } from "vue-i18n";
import { AssetUtils, WalletUtils } from "@/utils";
import { coin, type Coin } from "@0xsquid/sdk/node_modules/@cosmjs/amino";
import { ChainConstants, CurrencyUtils } from "@nolus/nolusjs";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { Dec, Int, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { externalWalletV2, transferCurrency, validateAddress, validateAmount as validateAmountUtil, walletOperation } from "../utils";
import { Squid } from "@0xsquid/sdk";
import { useApplicationStore } from "@/stores/application";
import { Decimal } from "@0xsquid/sdk/node_modules/@cosmjs/math";
import { AppUtils } from "@/utils/AppUtils";
import { SigningStargateClient } from "@0xsquid/sdk/node_modules/@cosmjs/stargate";
import { TxRaw } from '@0xsquid/sdk/node_modules/cosmjs-types/cosmos/tx/v1beta1/tx';
import { toHex } from "@0xsquid/sdk/node_modules/@cosmjs/encoding";
import { sha256 } from "@0xsquid/sdk/node_modules/@cosmjs/crypto";
import { MetaMaskWallet } from "@/wallet/metamask";
import { ASSETS } from "@/config/assetsInfo";
import { onMounted } from "vue";

const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const walletStore = useWalletStore();
const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const toWallet = ref<string>();

const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const password = ref('');
const memo = ref('');
const txHash = ref('');
const fee = ref<Coin>()
const isLoading = ref(false);
const networkCurrenciesObject = ref();
const app = useApplicationStore();
const networkType = ref(NetworkTypes.cosmos);
const metamaskAddress = ref<string | null>();
const receiverErrorMsg = ref<string>('')
const receiverAddress = ref<string>('')

const balances = ref<AssetBalance[]>(walletStore.balances.filter((item) => {
  const currency = walletStore.getCurrencyInfo(item.balance.denom);
  if (IGNORE_TRANSFER_ASSETS.includes(currency.ticker as string)) {
    return false;
  }
  return true;
}).map((item) => {
  // const e = { ...item }
  // const asset = walletStore.getCurrencyInfo(e.balance.denom);
  // const currency = walletStore.getCurrencyByTicker(asset.ticker);

  // if (e.balance.denom == walletStore.available.denom) {
  //   e.balance = { ...walletStore.available }
  // }
  // e.ticker = asset.ticker;
  // e.name = asset.shortName;
  // e.shortName = asset.shortName;
  // e.ibc_route = currency.ibc_route;
  // e.decimals = asset.coinDecimals;
  // e.symbol = currency.symbol;
  // e.native = currency.native;
  // return e;
  return item;
}));

const closeModal = inject("onModalClose", () => () => { });

let squidRouteRef: Squid;
let timeOut: NodeJS.Timeout;
let client: Wallet;
let toChainData: NetworkDataV2 | EvmChain;
let metamask: MetaMaskWallet;

const props = defineProps({
  networks: {
    type: Object as PropType<SquiRouterNetworkProp[]>,
    required: true
  }
});

const selectedNetwork = ref<SquiRouterNetworkProp>(props.networks[0]);
const squidRouter = async () => {

  if (squidRouteRef) {
    return squidRouteRef;
  }

  squidRouteRef = new Squid(SquidRouter);
  await squidRouteRef.init();

  return squidRouteRef;
}

onMounted(() => {
  networkParse();
})

const onUpdateNetwork = async (event: SquiRouterNetworkProp) => {
  selectedNetwork.value = event;
  networkCurrencies.value = [];
  disablePicker.value = true;

  const sr = await squidRouter();
  const fromChain = sr.chains.find(
    (c) => c.chainId === selectedNetwork.value.chainId
  ) as CosmosChain | EvmChain | undefined;

  const type = fromChain?.chainType as NetworkTypes | undefined;
  switch (type) {
    case (NetworkTypes.cosmos): {
      networkType.value = NetworkTypes.cosmos;
      if (selectedNetwork.value.native) {
        return networkParse();
      }
      return cosmosNetworkParse(fromChain as CosmosChain);
    }
    case (NetworkTypes.evm): {
      networkType.value = NetworkTypes.evm;
      return evmNetworkParse(fromChain as EvmChain);
    }
    default: {
      networkType.value = NetworkTypes.cosmos;
      break;
    }
  }

}

const networkParse = () => {
  const currencies: { [key: string]: AssetBalance } = {};

  for (const c of balances.value) {
    currencies[c.ticker as string] = c;
  }

  const items = balances.value;
  networkCurrenciesObject.value = currencies;
  selectedCurrency.value = items?.[0]
  networkCurrencies.value = items;
  disablePicker.value = false;

}

const cosmosNetworkParse = async (fromChain: CosmosChain) => {

  const assets = app?.networks?.[selectedNetwork.value.key];

  if (!assets) {
    return;
  }

  if (client) {
    client.destroy();
  }

  client = await Wallet.getInstance(fromChain.rpc, fromChain.rest);

  if (!selectedNetwork.value.native) {

    toChainData = {
      prefix: fromChain.bech32Config.bech32PrefixAccAddr,
      rpc: fromChain.rpc,
      rest: fromChain.rest,
      chainId: fromChain.chainId,
      embedChainInfo: () => {
        return {
          chainId: fromChain.chainId,
          chainName: 'Cosmos Hub',
          rpc: fromChain.rpc,
          rest: fromChain.rest,
          bip44: fromChain.bip44,
          bech32Config: fromChain.bech32Config,
          currencies: fromChain.currencies,
          feeCurrencies: fromChain.feeCurrencies,
          stakeCurrency: fromChain.stakeCurrency,
          features: fromChain.features,
        }
      }
    };

    const baseWallet = await externalWalletV2(client, toChainData, password.value) as BaseWallet;
    const currencies: { [key: string]: AssetBalance } = {};
    toWallet.value = baseWallet?.address;

    for (const c of balances.value) {
      currencies[c.ticker as string] = c;
    }

    const items = balances.value;
    networkCurrenciesObject.value = currencies;
    selectedCurrency.value = items?.[0]
    networkCurrencies.value = items;
    disablePicker.value = false;
  } else {
    selectedCurrency.value = walletStore.balances[0];
  }

}

const evmNetworkParse = async (toChain: EvmChain) => {
  toChainData = toChain;
  await checkEvmBalances();

}

const checkEvmBalances = async () => {
  const chains = await AppUtils.getSquitRouteNetworks();
  const chain = chains[selectedNetwork.value.key];
  const cr: AssetBalance[] = [];
  const currencies: { [key: string]: AssetBalance } = {};


  for (const c of balances.value) {
    const item = chain.currencies?.find((item) => item.to == c.ticker);
    if (item) {
      c.from = item.from;
      cr.push(c);
      currencies[c.ticker as string] = c;
    }

  }

  networkCurrenciesObject.value = currencies;
  selectedCurrency.value = cr?.[0]
  networkCurrencies.value = cr;
  disablePicker.value = false;
}

const connectMetamask = async () => {
//   metamask = new MetaMaskWallet();
//   const chainId = Number((toChainData as EvmChain).chainId);
//   await metamask.connect({
//     chainId: `0x${chainId.toString(16)}`,
//     chainName: (toChainData as EvmChain).networkName,
//     nativeCurrency: (toChainData as EvmChain).nativeCurrency,
//     rpcUrls: [(toChainData as EvmChain).rpc],
//     blockExplorerUrls: (toChainData as EvmChain).blockExplorerUrls
//   }, (toChainData as EvmChain).rpc);

//   metamaskAddress.value = metamask.shortAddress;
//   receiverAddress.value = metamask.address;
// }

// async function sendTXCosmos() {

//   try {

//     step.value = CONFIRM_STEP.PENDING;

//     const squid = await squidRouter();
//     const chains = await AppUtils.getSquitRouteNetworks();
//     const denom = AssetUtils.makeIBCMinimalDenom(selectedCurrency.value?.ibc_route!, selectedCurrency.value?.symbol!);

//     const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
//       amount.value,
//       denom,
//       selectedCurrency.value?.decimals!
//     );

//     const chain = chains[selectedNetwork.value.key];
//     const currency = squid.tokens.find((item) => item.chainId == chain.chainId && ASSETS[selectedCurrency.value.ticker as keyof typeof ASSETS].coinGeckoId == item.coingeckoId);

//     if (!currency) {
//       console.warn(`Not supported currency ${selectedCurrency.value.ticker} on chain ${selectedNetwork.value.key}`)
//       return false;
//     }

//     const params = {
//       fromAddress: walletStore?.wallet?.address as string,
//       fromChain: chains.NOLUS.chainId,
//       fromToken: minimalDenom.denom,
//       fromAmount: minimalDenom.amount.toString(),
//       toChain: selectedNetwork.value.chainId,
//       toToken: currency.address,
//       toAddress: toWallet.value as string,
//       slippage: 1.00,
//       quoteOnly: false,
//     };
//     const data = await squid.getRoute(params);

//     walletOperation(
//       async () => {
//         try {
//           const offlineSigner = walletStore.wallet?.getOfflineSigner() as any;
//           const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;

//           const signer = await SigningStargateClient.connectWithSigner(
//             url,
//             offlineSigner!
//           );

//           const cosmosTx = await squid.executeRoute({
//             signer,
//             signerAddress: walletStore.wallet?.address,
//             route: data.route,
//           }) as TxRaw;

//           const txBytes = Uint8Array.from(TxRaw.encode(cosmosTx).finish());
//           const tx = toHex(sha256(txBytes));

//           step.value = CONFIRM_STEP.SUCCESS;
//           txHash.value = tx;

//         } catch (error: Error | any) {
//           console.log(error)
//           switch (error.code) {
//             case (ErrorCodes.GasError): {
//               step.value = CONFIRM_STEP.GasErrorExternal;
//               break;
//             }
//             default: {
//               step.value = CONFIRM_STEP.ERROR;
//               break;
//             }
//           }
//         }

//       },
//       password.value
//     );
//   } catch (error: Error | any) {

//     if (error?.errors) {
//       let err = '';
//       for (const e of error.errors) {
//         err += e.message as string;
//       }
//       amountErrorMsg.value = err;
//       onConfirmBackClick();
//       step.value = CONFIRM_STEP.CONFIRM;
//     } else {
//       step.value = CONFIRM_STEP.ERROR;
//     }

//   }
}

async function sendTXEvm() {

  // try {

  //   step.value = CONFIRM_STEP.PENDING;

  //   const squid = await squidRouter();
  //   const chains = await AppUtils.getSquitRouteNetworks();
  //   const denom = AssetUtils.makeIBCMinimalDenom(selectedCurrency.value?.ibc_route!, selectedCurrency.value?.symbol!);

  //   const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
  //     amount.value,
  //     denom,
  //     selectedCurrency.value?.decimals!
  //   );

  //   const chain = chains[selectedNetwork.value.key];
  //   const currency = squid.tokens.find((item) => item.chainId == chain.chainId && selectedCurrency.value.from == item.symbol);

  //   if (!currency) {
  //     console.warn(`Not supported currency ${selectedCurrency.value.ticker} on chain ${selectedNetwork.value.key}`)
  //     return false;
  //   }

  //   const params = {
  //     fromAddress: walletStore?.wallet?.address as string,
  //     fromChain: chains.NOLUS.chainId,
  //     fromToken: minimalDenom.denom,
  //     fromAmount: minimalDenom.amount.toString(),
  //     toChain: selectedNetwork.value.chainId,
  //     toToken: currency.address,
  //     toAddress: receiverAddress.value as string,
  //     slippage: 1.00,
  //     quoteOnly: false,
  //   };

  //   const data = await squid.getRoute(params)

  //   walletOperation(
  //     async () => {
  //       try {
  //         const offlineSigner = walletStore.wallet?.getOfflineSigner() as any;
  //         const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;

  //         const signer = await SigningStargateClient.connectWithSigner(
  //           url,
  //           offlineSigner!
  //         );

  //         const cosmosTx = await squid.executeRoute({
  //           signer,
  //           signerAddress: walletStore.wallet?.address,
  //           route: data.route,
  //         }) as TxRaw;

  //         const txBytes = Uint8Array.from(TxRaw.encode(cosmosTx).finish());
  //         const tx = toHex(sha256(txBytes));

  //         step.value = CONFIRM_STEP.SUCCESS;
  //         txHash.value = tx;

  //       } catch (error: Error | any) {
  //         console.log(error)
  //         switch (error.code) {
  //           case (ErrorCodes.GasError): {
  //             step.value = CONFIRM_STEP.GasErrorExternal;
  //             break;
  //           }
  //           default: {
  //             step.value = CONFIRM_STEP.ERROR;
  //             break;
  //           }
  //         }
  //       }

  //     },
  //     password.value
  //   );
  // } catch (error: Error | any) {
  //   if (error?.errors) {
  //     let err = '';
  //     for (const e of error.errors) {
  //       err += e.message as string;
  //     }
  //     amountErrorMsg.value = err;
  //     onConfirmBackClick();
  //     step.value = CONFIRM_STEP.CONFIRM;
  //   } else {
  //     step.value = CONFIRM_STEP.ERROR;
  //   }
  // }

}

onUnmounted(() => {
  clearTimeout(timeOut);
  if (client) {
    client.destroy();
  }
});

watch(() => [selectedCurrency.value, amount.value], () => {
  if (amount.value.length > 0) {
    validateAmount()
  }
});

watch(() => receiverAddress.value, () => {
  switch (networkType.value) {
    case (NetworkTypes.cosmos): {
      if (selectedNetwork.value.native) {
        return validateNolusAddress();
      }
      break;
    }
    case (NetworkTypes.evm): {
      return validateEvmAddress();

    }
  }
});

const validateNolusAddress = () => {
  if (selectedNetwork.value.native) {
    receiverErrorMsg.value = validateAddress(receiverAddress.value);
  }
}

const validateEvmAddress = () => {
  receiverErrorMsg.value = ''

  if (!MetaMaskWallet.isValidAddress(receiverAddress.value)) {
    receiverErrorMsg.value = i18n.t("message.invalid-address");
  };
}

const receive = () => {
  validateInputs();
}

const handleAmountChange = (event: string) => {
  amount.value = event;
}

const validateInputs = async () => {

  if (!WalletUtils.isAuth()) {
    return false;
  }

  switch (networkType.value) {
    case (NetworkTypes.cosmos): {
      return validateInputsCosmos();
    }
    case (NetworkTypes.evm): {
      return validateInputsEvm();
    }
  }

}

const validateInputsCosmos = async () => {

  try {
    isLoading.value = true;
    const isValid = await validateAmount();

    validateNolusAddress();

    if (receiverErrorMsg.value.length > 0) {
      return false;
    }

    if (isValid) {

      fee.value = coin(GAS_FEES.transfer_amount, NATIVE_ASSET.denom);
      showConfirmScreen.value = true;

    }
  } catch (error) {
    console.log(error)
    step.value = CONFIRM_STEP.ERROR;
    showConfirmScreen.value = true;
  } finally {
    isLoading.value = false;
  }
}

const validateInputsEvm = async () => {

  try {
    isLoading.value = true;
    const isValid = await validateAmount();

    validateEvmAddress();

    if (receiverErrorMsg.value.length > 0) {
      return false;
    }

    if (isValid) {

      const chains = await AppUtils.getSquitRouteNetworks();

      const network = chains[selectedNetwork.value.key];
      const denom = selectedCurrency.value.balance.denom;
      fee.value = coin(network.fees.transfer, denom)
      showConfirmScreen.value = true;

    }
  } catch (error) {
    step.value = CONFIRM_STEP.ERROR;
    showConfirmScreen.value = true;
  } finally {
    isLoading.value = false;
  }
}

const validateAmount = async () => {

  amountErrorMsg.value = '';

  if (!WalletUtils.isAuth()) {
    return false;
  }

  if (!amount.value) {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
    return false;
  }

  switch (networkType.value) {
    case (NetworkTypes.cosmos): {
      return validateCosmos();
    }
    case (NetworkTypes.evm): {
      return validateEvm();
    }
  }

};

const validateCosmos = async () => {
  const error = validateAmountUtil(
    amount.value,
    selectedCurrency.value.balance.denom,
    selectedCurrency.value.balance.amount
  );

  amountErrorMsg.value = error;


  if (error.length > 0) {
    return false;
  }

  return true;
}

const validateEvm = async () => {

  try {

    const isLowerThanOrEqualsToZero = new Dec(amount.value).lte(new Dec(0));

    if (isLowerThanOrEqualsToZero) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-low");
      return false;
    }
    const decimals = selectedCurrency.value.decimals!;
    const walletBalance = Decimal.fromAtomics(selectedCurrency.value.balance.amount.toString(), decimals);
    const transferAmount = Decimal.fromUserInput(
      amount.value,
      decimals
    );

    const isGreaterThanWalletBalance = transferAmount.isGreaterThan(walletBalance);

    if (isGreaterThanWalletBalance) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-big");
      return false;
    }

  } catch (e) {
    console.log(e)
    amountErrorMsg.value = i18n.t("message.unexpected-error");
    return false;
  }

  return true;
}

const onSendClick = async () => {

  // switch (networkType.value) {
  //   case (NetworkTypes.cosmos): {
  //     if (selectedNetwork.value.native) {
  //       return transferAmount();
  //     }
  //     return sendTXCosmos();
  //   }
  //   case (NetworkTypes.evm): {
  //     return sendTXEvm();
  //   }
  // }
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = walletStore.getCurrencyInfo(
      selectedCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }

};

const setAmount = (p: number) => {
  switch (networkType.value) {
    case (NetworkTypes.cosmos): {
      const asset = AssetUtils.getAssetInfo(
        selectedCurrency.value.ticker as string
      );
      const percent = new Dec(p).quo(new Dec(100));
      const data = CurrencyUtils.convertMinimalDenomToDenom(selectedCurrency.value.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
      const value = data.mul(percent);
      amount.value = value.toString(asset.coinDecimals);
      break;
    }
    case (NetworkTypes.evm): {
      const percent = new Dec(p).quo(new Dec(100));
      const decimals = new Dec(10).pow(new Int(selectedCurrency.value.decimals!));
      const value = new Dec(selectedCurrency.value.balance.amount).quo(decimals).mul(percent);
      amount.value = value.toString(selectedCurrency.value.decimals!);
      break;
    }
  }

};

const total = computed(() => {
  // if (selectedCurrency.value) {
  //   const asset = walletStore.getCurrencyByTicker(
  //     selectedCurrency.value.ticker!
  //   );
  //   if (asset) {
  //     const ibc = AssetUtils.makeIBCMinimalDenom(asset.ibc_route, asset.symbol);
  //     return new KeplrCoin(ibc, selectedCurrency.value.balance.amount);
  //   }
  // }
  return undefined;

});

const transferAmount = async () => {
  step.value = CONFIRM_STEP.PENDING;

  const { success, txHash: txh, txBytes, usedFee } = await transferCurrency(
    selectedCurrency.value.balance.denom,
    amount.value,
    receiverAddress.value,
    memo.value
  );

  if (success) {
    txHash.value = txh;

    if (usedFee?.amount?.[0]) {
      fee.value = usedFee.amount[0];
    }

    try {
      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      // if (snackbarVisible()) {
      //   showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      // }
      await walletStore[WalletActionTypes.UPDATE_BALANCES]();

    } catch (error: Error | any) {
      switch (error.code) {
        case (ErrorCodes.GasError): {
          step.value = CONFIRM_STEP.GasError;
          break;
        }
        default: {
          step.value = CONFIRM_STEP.ERROR;
          break;
        }
      }
    }
  } else {
    step.value = CONFIRM_STEP.ERROR;
  }
};
</script>
