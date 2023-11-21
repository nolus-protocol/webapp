<template>
  <ConfirmExternalComponent
    v-if="showConfirmScreen"
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
    @passwordUpdate="(value) => (password = value)"
  />
  <template v-else>
    <div
      class="modal-send-receive-input-area overflow-auto custom-scroll"
      v-if="selectedNetwork?.native"
    >
      <div class="block text-left">

        <div class="block mt-[25px]">
          <Picker
            :default-option="selectedNetwork"
            :options="networks"
            :label="$t('message.network')"
            @update-selected="onUpdateNetwork"
          />
        </div>

        <div class="block mt-[18px]">
          <p class="text-14 nls-font-500 text-primary m-0 mb-[6px]">
            {{ $t("message.address") }}
          </p>
          <p class="text-14 text-primary nls-font-700 m-0 break-all">
            {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t('message.connect-wallet-label') }}
          </p>
          <div class="flex items-center justify-start mt-2">
            <button
              class="btn btn-secondary btn-medium-secondary btn-icon mr-2 flex"
              @click="onCopy(walletStore.wallet?.address ?? WalletManager.getWalletAddress());"
            >
              <DocumentDuplicateIcon class="icon w-4 h-4" />
              {{ copyText }}
            </button>
          </div>
        </div>

        <div class="flex justify-between w-full text-light-blue text-[14px] mt-4">
          <p>{{ $t("message.estimate-time") }}:</p>
          <p>~{{ selectedNetwork.estimation.duration }} {{ $t(`message.${selectedNetwork.estimation.type}`) }}</p>
        </div>
      </div>
    </div>
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
              />
            </div>

            <div>
              <p class="text-14 nls-font-500 text-primary m-0 mb-[6px] mt-4">
                {{ $t("message.recipient") }}
              </p>
              <p class="text-14 text-primary nls-font-700 m-0 break-all">
                {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t('message.connect-wallet-label') }}
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

import type { SquiRouterNetworkProp } from "@/types/NetworkConfig";
import type { AssetBalance } from "@/stores/wallet/state";
import type { CosmosChain, EvmChain } from "@0xsquid/squid-types";
import type { ExternalCurrencyType } from "@/types/CurreciesType";

import { Wallet, type BaseWallet } from "@/wallet";
import { NetworkTypes } from "@/types/NetworkConfig";

import { CONFIRM_STEP, TxType, type NetworkDataV2 } from "@/types";
import { ref, type PropType, inject, computed, onUnmounted, watch } from "vue";
import { DocumentDuplicateIcon } from "@heroicons/vue/24/solid";
import { ErrorCodes, IGNORE_TRANSFER_ASSETS, SquidRouter } from "@/config/env";
import { useI18n } from "vue-i18n";
import { AssetUtils, StringUtils, WalletManager, WalletUtils } from "@/utils";
import { coin, type Coin } from "@cosmjs/amino";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/stores/wallet";
import { Dec, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { externalWalletOperationV2, externalWalletV2 } from "../utils";
import { Squid } from "@0xsquid/sdk";
import { useApplicationStore } from "@/stores/application";
import { Decimal } from "@cosmjs/math";
import { ApptUtils } from "@/utils/AppUtils";
import { SigningStargateClient } from "@cosmjs/stargate";
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { toHex } from "@cosmjs/encoding";
import { sha256 } from "@cosmjs/crypto";

const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const walletStore = useWalletStore();
const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const sendWallet = ref<string>();

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

const closeModal = inject("onModalClose", () => () => { });

let squidRouteRef: Squid;
let timeOut: NodeJS.Timeout;
let client: Wallet;
let toChainData: NetworkDataV2;

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

const onUpdateNetwork = async (event: SquiRouterNetworkProp) => {
  selectedNetwork.value = event;
  networkCurrencies.value = [];
  disablePicker.value = true;

  const sr = await squidRouter();

  const toChain = sr.chains.find(
    (c) => c.chainId === selectedNetwork.value.chainId
  ) as CosmosChain | EvmChain | undefined;

  const type = toChain?.chainType as NetworkTypes | undefined;

  switch (type) {
    case (NetworkTypes.cosmos): {
      return cosmosNetworkParse(toChain as CosmosChain);
    }
  }

}

const cosmosNetworkParse = async (toChain: CosmosChain) => {

  const assets = app?.networks?.[selectedNetwork.value.key];

  if (!assets) {
    return;
  }

  if (client) {
    client.destroy();
  }

  client = await Wallet.getInstance(toChain.rpc, toChain.rest);

  if (!selectedNetwork.value.native) {
    const filteredAssets: { [key: string]: ExternalCurrencyType } = {};
    const currenciesPromise = [];

    toChainData = {
      prefix: toChain.bech32Config.bech32PrefixAccAddr,
      rpc: toChain.rpc,
      rest: toChain.rest,
      chainId: toChain.chainId,
      embedChainInfo: () => {
        return {
          chainId: toChain.chainId,
          chainName: 'Cosmos Hub',
          rpc: toChain.rpc,
          rest: toChain.rest,
          bip44: toChain.bip44,
          bech32Config: toChain.bech32Config,
          currencies: toChain.currencies,
          feeCurrencies: toChain.feeCurrencies,
          stakeCurrency: toChain.stakeCurrency,
          features: toChain.features,
        }
      }
    };

    const baseWallet = await externalWalletV2(client, toChainData, password.value) as BaseWallet;
    sendWallet.value = baseWallet?.address;


    for (const key in assets) {
      if (!IGNORE_TRANSFER_ASSETS.includes(key)) {
        filteredAssets[key] = assets[key];
      }
    }

    networkCurrenciesObject.value = filteredAssets;

    for (const key in filteredAssets) {

      const fn = async () => {
        const ibc_route = AssetUtils.makeIBCMinimalDenom(assets[key].ibc_route, assets[key].symbol);
        const balance = WalletUtils.isAuth() ? await client.getBalance(baseWallet.address as string, ibc_route) : coin(0, ibc_route);
        const icon = app.assetIcons?.[assets[key].ticker] as string;
        return {
          balance,
          name: assets[key].shortName,
          shortName: assets[key].shortName,
          icon: icon,
          ticker: assets[key].ticker,
          ibc_route: assets[key].ibc_route,
          decimals: Number(assets[key].decimal_digits),
          symbol: assets[key].symbol,
          native: assets[key].native
        };
      }

      currenciesPromise.push(fn());

    }

    const items = await Promise.all(currenciesPromise);
    selectedCurrency.value = items?.[0]
    networkCurrencies.value = items;
    disablePicker.value = false;
  } else {
    selectedCurrency.value = walletStore.balances[0];
  }

}

async function sendTX() {

  step.value = CONFIRM_STEP.PENDING;

  const squid = await squidRouter();
  const chains = await ApptUtils.getSquitRouteNetworks();
  const denom = AssetUtils.makeIBCMinimalDenom(selectedCurrency.value?.ibc_route!, selectedCurrency.value?.symbol!);
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    amount.value,
    denom,
    selectedCurrency.value?.decimals!
  );
  const asset = AssetUtils.getAssetInfo(selectedCurrency.value.ticker as string);

  const params = {
    fromAddress: sendWallet.value as string,
    fromChain: selectedNetwork.value.chainId,
    fromToken: minimalDenom.denom,
    fromAmount: minimalDenom.amount.toString(),
    toChain: chains.NOLUS.chainId,
    toToken: asset.coinMinimalDenom,
    toAddress: walletStore.wallet!.address as string,
    slippage: 1.00,
    quoteOnly: false,
  };

  const data = await squid.getRoute(params);
  console.log(data);


  externalWalletOperationV2(
    async () => {
      try {
        const baseWallet = await externalWalletV2(client, toChainData, password.value) as BaseWallet;
        const offlineSigner = baseWallet.getOfflineSigner();
        const signer = await SigningStargateClient.connectWithSigner(
          toChainData.rpc,
          offlineSigner
        );

        const cosmosTx = await squid.executeRoute({
          signer,
          signerAddress: baseWallet.address,
          route: data.route,
        }) as TxRaw;

        const txBytes = Uint8Array.from(TxRaw.encode(cosmosTx).finish());
        const tx = toHex(sha256(txBytes));

        step.value = CONFIRM_STEP.SUCCESS;
        txHash.value = tx;

      } catch (error: Error | any) {
        switch (error.code) {
          case (ErrorCodes.GasError): {
            step.value = CONFIRM_STEP.GasErrorExternal;
            break;
          }
          default: {
            step.value = CONFIRM_STEP.ERROR;
            break;
          }
        }
      }

    },
    client,
    toChainData,
    password.value
  );
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

const onCopy = (wallet: string) => {
  copyText.value = i18n.t("message.copied");
  StringUtils.copyToClipboard(wallet);
  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t("message.copy");
  }, 2000);
};

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

  try {
    isLoading.value = true;
    const isValid = await validateAmount();
    if (isValid) {

      const chains = await ApptUtils.getSquitRouteNetworks();

      const network = chains[selectedNetwork.value.key];
      const ibc_route = selectedCurrency.value?.ibc_route;
      const symbol = selectedCurrency.value?.symbol;
      if (ibc_route && symbol) {
        fee.value = coin(network.fees.transfer, AssetUtils.makeIBCMinimalDenom(ibc_route, symbol))
        showConfirmScreen.value = true;
      }

    }
  } catch (error) {
    console.log(error)
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

  const prefix = toChainData.prefix;
  const ibc_route = selectedCurrency.value?.ibc_route;
  const symbol = selectedCurrency.value?.symbol;
  const decimals = selectedCurrency.value?.decimals;

  if (prefix && ibc_route && symbol && decimals) {

    try {
      const balance = await client.getBalance(sendWallet.value as string, AssetUtils.makeIBCMinimalDenom(ibc_route, symbol));
      const walletBalance = Decimal.fromAtomics(balance.amount, decimals);
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
    }

  } else {
    amountErrorMsg.value = i18n.t("message.unexpected-error");
    return false;
  }

  return true;
};

const onSendClick = async () => {
  sendTX();
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {

  if (!selectedCurrency.balance) {
    return;
  }

  if (selectedNetwork.value.native) {
    const asset = walletStore.getCurrencyInfo(
      selectedCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }

  if (!selectedCurrency.decimals || !selectedCurrency.name) {
    return;
  }

  return CurrencyUtils.convertMinimalDenomToDenom(
    selectedCurrency.balance.amount.toString(),
    selectedCurrency.balance.denom,
    selectedCurrency.name as string,
    selectedCurrency.decimals as number
  ).toString();

};

const setAmount = (p: number) => {
  const asset = AssetUtils.getAssetInfo(
    selectedCurrency.value.ticker as string
  );
  const percent = new Dec(p).quo(new Dec(100));
  const data = CurrencyUtils.convertMinimalDenomToDenom(selectedCurrency.value.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
  const value = data.mul(percent);
  amount.value = value.toString(asset.coinDecimals);
};

const total = computed(() => {
  if (selectedCurrency.value) {
    const asset = walletStore.getCurrencyByTicker(
      selectedCurrency.value.ticker!
    );
    if (asset) {
      const ibc = AssetUtils.makeIBCMinimalDenom(asset.ibc_route, asset.symbol);
      return new KeplrCoin(ibc, selectedCurrency.value.balance.amount);
    }
  }
})
</script>
