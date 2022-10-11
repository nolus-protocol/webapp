import type { ContractInfo } from "@/types";

export interface ContractConfig {
  [key: string]: {
    [key: string]: ContractInfo;
  };
}
