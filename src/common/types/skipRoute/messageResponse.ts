declare enum FeeType {
  SMART_RELAY = "SMART_RELAY"
}

declare enum BridgeType {
  IBC = "IBC",
  AXELAR = "AXELAR",
  CCTP = "CCTP",
  HYPERLANE = "HYPERLANE",
  OPINIT = "OPINIT",
  GO_FAST = "GO_FAST",
  STARGATE = "STARGATE",
  EUREKA = "EUREKA"
}

export interface MessagesResponse {
  msgs: [
    {
      multi_chain_msg: {
        chain_id: string;
        path: string[];
        msg: string;
        msg_type_url: string;
      };
    }
  ];
  txs: [
    {
      cosmos_tx: {
        chain_id: string;
        path: string[];
        msgs: [
          {
            msg: string;
            msg_type_url: string;
          }
        ];
        signer_address: string;
      };
      evm_tx: {
        chain_id: string;
        data?: string | undefined;
        required_erc20_approvals?:
          | {
              amount: string;
              spender: string;
              token_contract: string;
            }[]
          | undefined;
        signer_address?: string | undefined;
        to?: string | undefined;
        value?: string | undefined;
      };
      operations_indices: number[];
    }
  ];
  estimatedFees?:
    | {
        feeType?: FeeType | undefined;
        bridgeId?: BridgeType | undefined;
        amount?: string | undefined;
        usdAmount?: string | undefined;
        originAsset: {
          chainId: string;
          coingeckoId?: string | undefined;
          decimals?: number | undefined;
          denom: string;
          description?: string | undefined;
          isCw20: boolean;
          isEvm: boolean;
          isSvm: boolean;
          logoUri?: string | undefined;
          name?: string | undefined;
          originChainId: string;
          originDenom: string;
          recommendedSymbol?: string | undefined;
          symbol?: string | undefined;
          tokenContract?: string | undefined;
          trace: string;
        };
        chainId?: string | undefined;
        txIndex?: number | undefined;
        operationIndex?: number | undefined;
      }[]
    | undefined;
}
