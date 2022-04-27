import { createLogger, createStore } from 'vuex'
// import createPersistedState from 'vuex-persistedstate'
// TODO: How to surpass cyclical dependency linting errors cleanly?
import { State as WalletState, store as wallet, WalletStore } from '@/store/modules/wallet'

export type RootState = {
  wallet: WalletState
};

export type Store = WalletStore<Pick<RootState, 'wallet'>>
const debug = process.env.NODE_ENV !== 'production'
const plugins = debug ? [createLogger({})] : []

// Plug in session storage based persistence
// plugins.push(createPersistedState({ storage: window.sessionStorage }))

export const store = createStore({
  plugins,
  modules: {
    wallet
  }
})

export function useStore (): Store {
  return store as Store
}
