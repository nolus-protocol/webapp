import { createStore } from 'vuex'
import { NolusClient } from '@/client/NolusClient'
import KeplrEmbedChainInfo, { IBCAssets, WalletConnectMechanism, WalletManager } from '@/config/wallet'
import { nolusLedgerWallet, nolusOfflineSigner } from '@/wallet/NolusWalletFactory'
import { makeCosmoshubPath } from '@cosmjs/amino'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'
import { LedgerSigner } from '@cosmjs/ledger-amino'
import { BECH32_PREFIX_ACC_ADDR, COIN_MINIMAL_DENOM } from '@/constants/chain'
import { NolusWallet } from '@/wallet/NolusWallet'
import { KeyUtils } from '@/utils/KeyUtils'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import OpenLogin from '@toruslabs/openlogin'
import { makeIBCMinimalDenom } from '@/utils/AssetUtils'
import { fromHex, toHex } from '@cosmjs/encoding'
import { EncryptionUtils } from '@/utils/EncryptionUtils'
import { Coin } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@/utils/CurrencyUtils'
import { WalletUtils } from '@/utils/WalletUtils'
import { DeliverTxResponse } from '@cosmjs/stargate'

export interface AssetBalance {
  udenom: string,
  balance: Coin
}

export default createStore({
  state: {
    torusClient: {},
    wallet: {} as NolusWallet,
    privateKey: '',
    balances: [] as AssetBalance[]
  },
  getters: {
    getBalances: state => state.balances,
    async getWallet (state) {
      return await state.wallet
    }
  },
  mutations: {
    signWallet (state, payload: { wallet: NolusWallet }) {
      console.log('dsadada')
      state.wallet = payload.wallet
    },
    torusLogin (state, payload: OpenLogin) {
      state.torusClient = payload
    },
    setPrivateKey (state, payload: { privateKey: string }) {
      state.privateKey = payload.privateKey
    },
    updateBalances (state, payload: { balances: [] }) {
      state.balances = payload.balances
    }
  },
  actions: {
    async connectToKeplr (context) {
      const keplrWindow = await WalletUtils.getKeplr()

      if (!keplrWindow?.getOfflineSigner) {
        throw new Error('Keplr wallet is not installed.')
      } else if (!keplrWindow.experimentalSuggestChain) {
        throw new Error('Keplr version is not latest. Please upgrade your Keplr wallet')
      } else {
        let chainId = ''
        try {
          chainId = await NolusClient.getInstance().getChainId()
          await keplrWindow.experimentalSuggestChain(KeplrEmbedChainInfo('devnet', chainId, 'https://net-dev.nolus.io:26612', 'https://net-dev.nolus.io:26614'))
        } catch (e) {
          throw new Error('Failed to fetch suggest chain.')
        }
        await keplrWindow.enable(chainId)
        if (keplrWindow.getOfflineSigner) {
          const offlineSigner = keplrWindow.getOfflineSigner(chainId)
          const nolusWalletOfflineSigner = await nolusOfflineSigner(offlineSigner)
          await nolusWalletOfflineSigner.useAccount()
          await context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
          await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
          WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.EXTENSION)
          // router.push({ name: 'dashboard' })
        }
      }
    },
    async connectToLedger (context) {
      let breakLoop = false
      let ledgerWallet = null
      // 20 sec timeout to let the user unlock his hardware
      const to = setTimeout(() => (breakLoop = true), 20000)
      const accountNumbers = [0]
      const paths = accountNumbers.map(makeCosmoshubPath)
      while (!ledgerWallet && !breakLoop) {
        try {
          const transport = await TransportWebUSB.create()
          ledgerWallet = await nolusLedgerWallet(new LedgerSigner(transport, {
            prefix: BECH32_PREFIX_ACC_ADDR,
            hdPaths: paths
          }))
          await ledgerWallet.useAccount()
          context.commit('signWallet', { wallet: ledgerWallet })
          await context.dispatch('updateBalances', { walletAddress: ledgerWallet.address })
          WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.LEDGER)
        } catch (e) {
          console.log('break!')
          console.log(e)
          breakLoop = true
        }
      }
      clearTimeout(to)
    },
    async connectViaMnemonic (context, payload: { mnemonic: string }) {
      console.log('mnemonic: ' + payload.mnemonic)
      const accountNumbers = [0]
      const path = accountNumbers.map(makeCosmoshubPath)[0]
      // const mnemonic = 'industry helmet coach enforce laundry excuse core argue poem master sugar demand'
      const privateKey = await KeyUtils.getPrivateKeyFromMnemonic(payload.mnemonic, path)
      const directSecrWallet = await DirectSecp256k1Wallet.fromKey(privateKey, BECH32_PREFIX_ACC_ADDR)
      const nolusWalletOfflineSigner = await nolusOfflineSigner(directSecrWallet)
      await nolusWalletOfflineSigner.useAccount()
      context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
      context.commit('setPrivateKey', { privateKey: toHex(privateKey) })
      await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
      WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.MNEMONIC)
    },
    async loginViaTorus (context) {
      const openlogin = new OpenLogin({
        clientId: 'BNV7ajBdHUgKnfDImRy6j3ld-KK2RLB6I7SMtGLeJCtw7iqpU1cl8C4tSh8JN3hV0W_n2PwXqVTGdQ1JMh4AbwA',
        network: 'testnet' // valid values (testnet or mainnet)
      })
      context.commit('torusLogin', openlogin)
      await openlogin.init()

      if (!openlogin.privKey) {
        console.log('1private key: ', openlogin.privKey)
        await openlogin.login()
      } else {
        const bufferedPrivateKey = Buffer.from(openlogin.privKey.trim().replace('0x', ''), 'hex')
        const directSecrWallet = await DirectSecp256k1Wallet.fromKey(bufferedPrivateKey, BECH32_PREFIX_ACC_ADDR)
        const nolusWalletOfflineSigner = await nolusOfflineSigner(directSecrWallet)
        await nolusWalletOfflineSigner.useAccount()
        context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
        context.commit('setPrivateKey', { privateKey: toHex(bufferedPrivateKey) })
        await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
        WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.TORUS)
      }
    },
    async torusLogout (context) {
      if (context.state.torusClient) {
        const openlogin = (context.state.torusClient as OpenLogin)
        await openlogin.logout()
      }
    },
    storePrivateKey (context, payload: { password: string }) {
      if (payload.password !== '' && context.state.privateKey !== '') {
        const pubKey = toHex(context.state.wallet.pubKey || new Uint8Array(0))
        const encryptedPbKey = EncryptionUtils.encryptEncryptionKey(pubKey, payload.password)
        const encryptedPk = EncryptionUtils.encryptPrivateKey(
          context.state.privateKey,
          pubKey,
          payload.password)

        WalletManager.storeEncryptedPubKey(encryptedPbKey)
        WalletManager.storeEncryptedPk(encryptedPk)
        context.commit('setPrivateKey', { privateKey: '' })
      }
    },
    async loadPrivateKeyAndSign (context, payload: { password: string }) {
      if (context.state.privateKey === '' && payload.password !== '') {
        const encryptedPubKey = WalletManager.getEncryptedPubKey()
        const encryptedPk = WalletManager.getPrivateKey()
        const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(encryptedPubKey, payload.password)
        const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(encryptedPk, decryptedPubKey, payload.password)
        const directSecrWallet = await DirectSecp256k1Wallet.fromKey(fromHex(decryptedPrivateKey), BECH32_PREFIX_ACC_ADDR)
        const nolusWalletOfflineSigner = await nolusOfflineSigner(directSecrWallet)
        await nolusWalletOfflineSigner.useAccount()
        context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
        context.commit('setPrivateKey', { privateKey: '' })
        await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
      }
    },
    async updateBalances (context, payload: { walletAddress: string }) {
      console.log(payload.walletAddress)
      if (!payload.walletAddress && !KeyUtils.isAddressValid(payload.walletAddress)) {
        return
      }

      const ibcBalances = [] as AssetBalance[]
      const nolusBalance = await NolusClient.getInstance()
        .getBalance(payload.walletAddress,
          COIN_MINIMAL_DENOM)
      ibcBalances.push({
        udenom: COIN_MINIMAL_DENOM,
        balance: CurrencyUtils.convertCosmosCoinToKeplCoin(nolusBalance)
      })

      for (const asset of IBCAssets) {
        const ibcDenom = makeIBCMinimalDenom(asset.sourceChannelId, asset.coinMinimalDenom)
        const balance = await NolusClient.getInstance()
          .getBalance(payload.walletAddress,
            ibcDenom)

        ibcBalances.push({
          udenom: asset.coinMinimalDenom,
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(balance)
        })
      }
      context.commit('updateBalances', { balances: ibcBalances })
    },
    async transferTokens (context, payload: {
      receiverAddress: string,
      amount: string | undefined,
      feeAmount: string
    }): Promise<DeliverTxResponse | undefined> {
      console.log('payload: ', payload)
      if (!payload.amount) {
        return
      }
      const DEFAULT_FEE = {
        // TODO 0.0025unolus
        amount: [{
          denom: 'unolus',
          amount: payload.feeAmount
        }],
        gas: '100000'
      }
      const txResponse = await context.state.wallet.sendTokens(
        context.state.wallet.address as string,
        payload.receiverAddress,
        [{
          denom: 'unolus',
          amount: payload.amount
        }],
        DEFAULT_FEE
      )

      await context.dispatch('updateBalances', { walletAddress: context.state.wallet.address })
      return txResponse
    }
  },
  modules: {}
})
