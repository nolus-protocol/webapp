import { type Store } from "../types";
import { WalletUtils } from "@/common/utils";
import { WalletConnectMechanism } from "@/common/types";
import { connectKeplrLike } from "./connectKeplrLike";

export async function connectLeap(this: Store) {
  await connectKeplrLike(this, WalletUtils.getLeap, WalletConnectMechanism.LEAP, "Leap");
}
