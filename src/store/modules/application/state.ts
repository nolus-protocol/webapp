import { NetworkConfig } from '@/types/NetworkConfig'

export type State = {
  network: NetworkConfig | null
}

export const state: State = {
  network: null
}
