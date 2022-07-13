import { ContractInfo } from '@/types/ContractInfo'

export interface ContractConfig {
  [key: string]: {
    [key: string]: ContractInfo
  }
}
