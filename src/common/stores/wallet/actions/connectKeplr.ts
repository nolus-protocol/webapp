import { type Store } from "../types";
import { WalletUtils } from "@/common/utils";
import { WalletConnectMechanism } from "@/common/types";
import { connectKeplrLike } from "./connectKeplrLike";

export async function connectKeplr(this: Store) {
  await connectKeplrLike(this, WalletUtils.getKeplr, WalletConnectMechanism.KEPLR, "Keplr");
}
