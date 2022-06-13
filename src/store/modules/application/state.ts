import { NetworkConfig } from '@/config/env'

export type State = {
  network: NetworkConfig | null
}

export const state: State = {
  network: null
}
