import { EnvNetworkUtils } from "@/common/utils";
import type { State } from "../types";

export function contracts(state: State) {
  const network = EnvNetworkUtils.getStoredNetworkName();
  return state.protocols[network];
}
