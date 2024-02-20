import type { ProtocolContracts } from "@nolus/nolusjs/build/contracts";

export type State = {
  protocols: {
    [key in Networks]: Protocol
  };
};

export type Networks = 'localnet' | 'devnet' | 'testnet' | 'mainnet';

export type Protocol = {
  [key: string]: ProtocolContracts
}
