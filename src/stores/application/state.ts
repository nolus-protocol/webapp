import type { NetworkConfig } from "@/types/NetworkConfig";

export type State = {
  network: NetworkConfig;
  theme: string | null;
  apr: number | null,
  dispatcherRewards: number | null,
  sessionExpired:  boolean
};
