import { NetworkConfig } from '@/config/env.config'

export type State = {
  network: NetworkConfig | null
}

export const state: State = {
  network: null
}
