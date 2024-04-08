import type { Coin as UnitCoin } from "@keplr-wallet/unit";

export interface Asset {
  balance: UnitCoin | any;
  key: string;
}
