import { ActionContext, ActionTree } from 'vuex'
import { Window as KeplrWindow } from '@keplr-wallet/types/build/window'
import { IndexedTx } from '@cosmjs/stargate'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { fromHex, toHex } from '@cosmjs/encoding'
import { makeCosmoshubPath } from '@cosmjs/amino'
import { LedgerSigner } from '@cosmjs/ledger-amino'
import { AssetUtils, KeyUtils, NolusClient, NolusWalletFactory } from '@nolus/nolusjs'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { CurrencyUtils } from '@nolus/nolusjs/build/utils/CurrencyUtils'
import OpenLogin from '@toruslabs/openlogin'

import { RootState } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { WalletUtils } from '@/utils/WalletUtils'
import { KeyUtils as KeyUtilities } from '@/utils/KeyUtils'
import KeplrEmbedChainInfo from '@/config/keplr'
import router from '@/router'
import { WalletMutationTypes } from '@/store/modules/wallet/mutation-types'
import { Getters } from '@/store/modules/wallet/getters'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { EncryptionUtils } from '@/utils/EncryptionUtils'
import { RouteNames } from '@/router/RouterNames'
import { IbcAssets, supportedCurrencies } from '@/config/currencies'
import { WalletConnectMechanism } from '@/types/WalletConnectMechanism'
import { WalletManager } from '@/wallet/WalletManager'

import { AssetBalance, State } from './state'
import { Mutations } from './mutations'
import BluetoothTransport from '@ledgerhq/hw-transport-web-ble'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'

type AugmentedActionContext = {
  commit<K extends keyof Mutations> (
    key: K,
    payload: Parameters<Mutations[K]>[1],
  ): ReturnType<Mutations[K]>
  getters<K extends keyof Getters> (
    key: K,
    payload: Parameters<Getters[K]>[1],
  ): ReturnType<Getters[K]>
} & Omit<ActionContext<State, RootState>, 'commit'>

export interface Actions {
  [WalletActionTypes.CONNECT_KEPLR] ({ commit }: AugmentedActionContext, payload: { isFromAuth: boolean }): void,

  [WalletActionTypes.CONNECT_LEDGER] ({
    commit,
    dispatch
  }: AugmentedActionContext, payload: { isFromAuth: boolean, isBluetooth: boolean }): void,

  [WalletActionTypes.CONNECT_VIA_MNEMONIC] ({
    commit,
    getters,
    dispatch
  }: AugmentedActionContext, payload: { mnemonic: string }): void,

  [WalletActionTypes.LOGIN_VIA_TORUS] ({ commit }: AugmentedActionContext): void,

  [WalletActionTypes.TORUS_LOGOUT] ({
    commit,
    getters
  }: AugmentedActionContext): void,

  [WalletActionTypes.STORE_PRIVATE_KEY] ({
    commit,
    getters,
    dispatch
  }: AugmentedActionContext, payload: { password: string }): void,

  [WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN] ({
    commit,
    getters,
    dispatch
  }: AugmentedActionContext, payload: { password: string }): Promise<void>,

  [WalletActionTypes.UPDATE_BALANCES] ({ commit }: AugmentedActionContext): void,

  [WalletActionTypes.SEARCH_TX] ({
    commit,
    getters
  }: AugmentedActionContext): Promise<readonly IndexedTx[]>,
}

export const actions: ActionTree<State, RootState> & Actions = {
  async [WalletActionTypes.CONNECT_KEPLR] ({
    commit,
    dispatch
  }, payload: { isFromAuth: false }) {
    await WalletUtils.getKeplr()
    const keplrWindow = window as KeplrWindow
    if (!keplrWindow.getOfflineSigner || !keplrWindow.keplr) {
      throw new Error('Keplr wallet is not installed.')
    } else if (!keplrWindow.keplr.experimentalSuggestChain) {
      throw new Error('Keplr version is not latest. Please upgrade your Keplr wallet')
    } else {
      let chainId = ''
      try {
        chainId = await NolusClient.getInstance().getChainId()
        const networkConfig = EnvNetworkUtils.loadNetworkConfig()
        await keplrWindow.keplr?.experimentalSuggestChain(KeplrEmbedChainInfo(EnvNetworkUtils.getStoredNetworkName(), chainId, networkConfig?.tendermintRpc as string, networkConfig?.api as string))
      } catch (e) {
        throw new Error('Failed to fetch suggest chain.')
      }
      await keplrWindow.keplr?.enable(chainId)
      if (keplrWindow.getOfflineSigner) {
        const offlineSigner = keplrWindow.getOfflineSigner(chainId)
        const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner)
        await nolusWalletOfflineSigner.useAccount()
        commit(WalletMutationTypes.SIGN_WALLET, { wallet: nolusWalletOfflineSigner })
        dispatch(WalletActionTypes.UPDATE_BALANCES, { walletAddress: nolusWalletOfflineSigner.address }) // check this
        WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.EXTENSION)
        WalletManager.storeWalletAddress(nolusWalletOfflineSigner.address || '')
        if (payload?.isFromAuth) {
          await router.push({ name: RouteNames.DASHBOARD })
        }
      }
    }
  },
  async [WalletActionTypes.CONNECT_LEDGER] ({
    commit,
    dispatch
  }, payload: { isFromAuth: false, isBluetooth: boolean }) {
    let breakLoop = false
    let ledgerWallet = null
    // 20 sec timeout to let the user unlock his hardware
    const to = setTimeout(() => (breakLoop = true), 20000)
    const accountNumbers = [0]
    const paths = accountNumbers.map(makeCosmoshubPath)
    while (!ledgerWallet && !breakLoop) {
      try {
        const isConnectedViaLedgerBluetooth = WalletManager.getWalletConnectMechanism() === WalletConnectMechanism.LEDGER_BLUETOOTH
        const transport = payload.isBluetooth || isConnectedViaLedgerBluetooth ? await BluetoothTransport.create() : await TransportWebUSB.create()

        ledgerWallet = await NolusWalletFactory.nolusLedgerWallet(new LedgerSigner(transport, {
          prefix: ChainConstants.BECH32_PREFIX_ACC_ADDR,
          hdPaths: paths
        }))

        await ledgerWallet.useAccount()
        commit(WalletMutationTypes.SIGN_WALLET, { wallet: ledgerWallet })
        WalletManager.saveWalletConnectMechanism(
          payload.isBluetooth ? WalletConnectMechanism.LEDGER_BLUETOOTH : WalletConnectMechanism.LEDGER
        )
        WalletManager.storeWalletAddress(ledgerWallet.address || '')
        await dispatch(WalletActionTypes.UPDATE_BALANCES)
        if (payload?.isFromAuth) {
          await router.push({ name: RouteNames.DASHBOARD })
        }
      } catch (e: any) {
        throw new Error(e)
        breakLoop = true
      }
    }
    clearTimeout(to)
  },
  async [WalletActionTypes.CONNECT_VIA_MNEMONIC] ({
    commit,
    getters,
    dispatch
  }, { mnemonic }: { mnemonic: string }) {
    let privateKey: Uint8Array
    if (KeyUtilities.isPrivateKey(mnemonic)) {
      privateKey = Buffer.from(mnemonic.trim().replace('0x', ''), 'hex')
    } else {
      const accountNumbers = [0]
      const path = accountNumbers.map(makeCosmoshubPath)[0]
      privateKey = await KeyUtils.getPrivateKeyFromMnemonic(mnemonic, path)
    }

    const directSecrWallet = await DirectSecp256k1Wallet.fromKey(privateKey, ChainConstants.BECH32_PREFIX_ACC_ADDR)
    const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet)
    await nolusWalletOfflineSigner.useAccount()
    commit(WalletMutationTypes.SIGN_WALLET, { wallet: nolusWalletOfflineSigner })
    commit(WalletMutationTypes.SET_PRIVATE_KEY, { privateKey: toHex(privateKey) })
    WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.MNEMONIC)
    WalletManager.storeWalletAddress(nolusWalletOfflineSigner.address || '')
    await dispatch(WalletActionTypes.UPDATE_BALANCES)
  },
  async [WalletActionTypes.LOGIN_VIA_TORUS] ({ commit }) {
    const openlogin = new OpenLogin({
      clientId: 'BNV7ajBdHUgKnfDImRy6j3ld-KK2RLB6I7SMtGLeJCtw7iqpU1cl8C4tSh8JN3hV0W_n2PwXqVTGdQ1JMh4AbwA',
      network: 'testnet' // valid values (testnet or mainnet)
    })
    commit(WalletMutationTypes.TORUS_LOGIN, openlogin)
    await openlogin.init()

    if (!openlogin.privKey) {
      await openlogin.login()
    } else {
      const bufferedPrivateKey = Buffer.from(openlogin.privKey.trim().replace('0x', ''), 'hex')
      const directSecrWallet = await DirectSecp256k1Wallet.fromKey(bufferedPrivateKey, ChainConstants.BECH32_PREFIX_ACC_ADDR)
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet)
      await nolusWalletOfflineSigner.useAccount()
      commit(WalletMutationTypes.SIGN_WALLET, { wallet: nolusWalletOfflineSigner })
      commit(WalletMutationTypes.SET_PRIVATE_KEY, { privateKey: toHex(bufferedPrivateKey) })
      // await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
      WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.TORUS)
    }
  },
  async [WalletActionTypes.TORUS_LOGOUT] ({
    commit,
    getters
  }) {

    // if (use getters) {
    //   const openlogin = (context.state.torusClient as OpenLogin)
    //   await openlogin.logout()
    // }
  },
  async [WalletActionTypes.STORE_PRIVATE_KEY] ({
    commit,
    getters,
    dispatch
  }, payload: { password: string }) {
    if (payload.password !== '' && getters.getPrivateKey !== '') {
      const pubKey = toHex(getters.getNolusWallet.pubKey || new Uint8Array(0))
      const encryptedPbKey = EncryptionUtils.encryptEncryptionKey(pubKey, payload.password)
      const encryptedPk = EncryptionUtils.encryptPrivateKey(
        getters.getPrivateKey,
        pubKey,
        payload.password)

      WalletManager.storeEncryptedPubKey(encryptedPbKey)
      WalletManager.storeEncryptedPk(encryptedPk)
      commit(WalletMutationTypes.SET_PRIVATE_KEY, { privateKey: '' })
    }
  },
  async [WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN] ({
    commit,
    getters,
    dispatch
  }, payload: { password: string }): Promise<void> {
    if (getters.getPrivateKey === '' && payload.password !== '') {
      const encryptedPubKey = WalletManager.getEncryptedPubKey()
      const encryptedPk = WalletManager.getPrivateKey()
      const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(encryptedPubKey, payload.password)
      const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(encryptedPk, decryptedPubKey, payload.password)
      const directSecrWallet = await DirectSecp256k1Wallet.fromKey(fromHex(decryptedPrivateKey), ChainConstants.BECH32_PREFIX_ACC_ADDR)
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(directSecrWallet)
      await nolusWalletOfflineSigner.useAccount()

      commit(WalletMutationTypes.SIGN_WALLET, { wallet: nolusWalletOfflineSigner })
      commit(WalletMutationTypes.SET_PRIVATE_KEY, { privateKey: '' })
      await dispatch(WalletActionTypes.UPDATE_BALANCES)
    }
  },
  async [WalletActionTypes.UPDATE_BALANCES] ({ commit }) {
    try {
      const walletAddress = WalletManager.getWalletAddress() || ''
      if (!WalletUtils.isAuth()) {
        WalletManager.eraseWalletInfo()
        await router.push({ name: RouteNames.AUTH })
        return
      }

      const ibcBalances = [] as AssetBalance[]
      for (const currency of supportedCurrencies) {
        const balance = await NolusClient.getInstance()
          .getBalance(walletAddress,
            currency)
        ibcBalances.push({
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(balance)
        })
      }

      for (const ibcAsset of IbcAssets) {
        const ibcDenom = AssetUtils.makeIBCMinimalDenom(ibcAsset.sourceChannelId, ibcAsset.coinMinimalDenom)
        const balance = await NolusClient.getInstance()
          .getBalance(walletAddress,
            ibcDenom)

        ibcBalances.push({
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(balance)
        })
      }

      commit(WalletMutationTypes.UPDATE_BALANCES, { balances: ibcBalances })
    } catch (e: any) {
      throw new Error(e)
    }
  },
  async [WalletActionTypes.SEARCH_TX] ({
    commit,
    getters
  }): Promise<readonly IndexedTx[]> {
    const nolusClient = await NolusClient.getInstance()
    return nolusClient.searchTxByAddress(WalletManager.getWalletAddress() || '')
  }
}
