import { createLogger, createStore } from 'vuex'
// import createPersistedState from 'vuex-persistedstate'
// TODO: How to surpass cyclical dependency linting errors cleanly?
import { State as WalletState, store as wallet, WalletStore } from '@/store/modules/wallet'
import { ApplicationStore, State as ApplicationState, store as application } from '@/store/modules/application'
import { OracleStore, State as OracleState, store as oracle } from '@/store/modules/oracle'

export type RootState = {
  wallet: WalletState
  application: ApplicationState
  oracle: OracleState
};

export type Store =
  WalletStore<Pick<RootState, 'wallet'>>
  & ApplicationStore<Pick<RootState, 'application'>>
  & OracleStore<Pick<RootState, 'oracle'>>
const debug = process.env.NODE_ENV !== 'production'
const plugins = debug ? [createLogger({})] : []

// Plug in session storage based persistence
// plugins.push(createPersistedState({ storage: window.sessionStorage }))

export const store = createStore({
  plugins,
  modules: {
    wallet,
    application,
    oracle
  }
})

export function useStore (): Store {
  return store as Store
}
