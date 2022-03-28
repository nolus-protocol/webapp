import { createStore } from 'vuex'
import { NolusClient } from '@/client/NolusClient'
import { Window as KeplrWindow } from '@keplr-wallet/types'
import KeplrEmbedChainInfo, { IBCAssets } from '@/config/wallet'
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

export default createStore({
  state: {
    torusClient: {},
    wallet: {} as NolusWallet,
    balances: []
  },
  getters: {},
  mutations: {
    signWallet (state, payload: { wallet: NolusWallet }) {
      state.wallet = payload.wallet
    },
    torusLogin (state, payload: OpenLogin) {
      state.torusClient = payload
    },
    updateBalances (state, payload: { balances: [] }) {
      state.balances = payload.balances
    }
  },
  actions: {
    async connectToKeplr (context) {
      const keplrWindow = window as KeplrWindow
      if (!keplrWindow.getOfflineSigner || !keplrWindow.keplr) {
        throw new Error('Keplr wallet is not installed.')
      } else if (!keplrWindow.keplr.experimentalSuggestChain) {
        throw new Error('Keplr version is not latest. Please upgrade your Keplr wallet')
      } else {
        let chainId = ''
        try {
          chainId = await NolusClient.getInstance().getChainId()
          await keplrWindow.keplr?.experimentalSuggestChain(KeplrEmbedChainInfo('devnet', chainId, 'https://net-dev.nolus.io:26612', 'https://net-dev.nolus.io:26614'))
        } catch (e) {
          throw new Error('Failed to fetch suggest chain.')
        }
        await keplrWindow.keplr?.enable(chainId)
        if (keplrWindow.getOfflineSigner) {
          const offlineSigner = keplrWindow.getOfflineSigner(chainId)
          const nolusWalletOfflineSigner = await nolusOfflineSigner(offlineSigner)
          await nolusWalletOfflineSigner.useAccount()
          context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
          await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
        }
      }
    },
    async connectToLedger (context) {
      let breakLoop = false
      let ledgerWallet = null
      // 10 sec timeout to let the user unlock his hardware
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
        } catch (e) {
          console.log('break!')
          console.log(e)
          breakLoop = true
        }
      }

      clearTimeout(to)
    },
    async connectViaMnemonic (context) {
      const accountNumbers = [0]
      const path = accountNumbers.map(makeCosmoshubPath)[0]
      const mnemonic = 'industry helmet coach enforce laundry excuse core argue poem master sugar demand'
      const privateKey = await KeyUtils.getPrivateKeyFromMnemonic(mnemonic, path)
      const directSecrWallet = await DirectSecp256k1Wallet.fromKey(privateKey, BECH32_PREFIX_ACC_ADDR)
      const nolusWalletOfflineSigner = await nolusOfflineSigner(directSecrWallet)
      await nolusWalletOfflineSigner.useAccount()
      context.commit('signWallet', { wallet: nolusWalletOfflineSigner })
      await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
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
        await context.dispatch('updateBalances', { walletAddress: nolusWalletOfflineSigner.address })
      }
    },
    async torusLogout (context) {
      if (context.state.torusClient) {
        const openlogin = (context.state.torusClient as OpenLogin)
        await openlogin.logout()
      }
    },
    async generateWallet () {
      const generatedPrivateKey = KeyUtils.generatePrivateKey()
      console.log(generatedPrivateKey)
      const publicKey = await KeyUtils.getPublicKeyFromPrivateKey(generatedPrivateKey)
      const address = KeyUtils.getAddressFromPublicKey(publicKey)
      console.log('Address: ', address)
      console.log('isValidAddress: ', KeyUtils.isAddressValid(address))
    },
    async updateBalances (context, payload: { walletAddress: string }) {
      if (!payload.walletAddress) {
        return
      }
      const ibcBalances = []
      const nolusBalance = await NolusClient.getInstance()
        .getBalance(payload.walletAddress,
          COIN_MINIMAL_DENOM)
      ibcBalances.push({
        udenom: COIN_MINIMAL_DENOM,
        balance: nolusBalance
      })

      for (const asset of IBCAssets) {
        const ibcDenom = makeIBCMinimalDenom(asset.sourceChannelId, asset.coinMinimalDenom)
        const balance = await NolusClient.getInstance()
          .getBalance(payload.walletAddress,
            ibcDenom)

        ibcBalances.push({
          udenom: asset.coinMinimalDenom,
          balance: balance
        })
      }
      context.commit('updateBalances', { balances: ibcBalances })
    }
  },
  modules: {}
})
