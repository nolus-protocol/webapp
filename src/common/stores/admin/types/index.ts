import type { Networks } from "@/common/types";
import type { HistoryProtocols } from "@/common/types/Currecies";
import type { ProtocolContracts } from "@nolus/nolusjs/build/contracts";

export type State = {
  protocols: {
    [key in Networks]?: Protocol;
  };
  history_protocols: {
    [key: string]: HistoryProtocols;
  };
};

export type Protocol = {
  [key: string]: ProtocolContracts;
};

export enum AdminActions {
  GET_PROTOCOLS = "GET_PROTOCOLS"
}

export type Store = ReturnType<(typeof import(".."))["useAdminStore"]>;
