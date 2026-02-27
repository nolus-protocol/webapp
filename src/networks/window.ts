import type { Keplr } from "@keplr-wallet/types";

export interface Window {
  ethereum?: Record<string, unknown>;
  keplr?: Keplr;
  leap?: Keplr;
  phantom?: Record<string, unknown>;
  solflare?: Record<string, unknown>;
}
