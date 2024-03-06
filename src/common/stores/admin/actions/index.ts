import { AdminActions } from "..";
import { getProtocols } from "./getProtocols";

export const actions = {
  [AdminActions.GET_PROTOCOLS]: getProtocols
};
