export interface MessagesRequest {
  source_asset_chain_id: string;
  dest_asset_chain_id: string;
  chain_ids_to_affiliates: {
    [x: string]: {
      affiliates: {
        address: string;
        basisPointsFee: string;
      }[];
    };
  };
  timeout_seconds: string;
  operations: [
    {
      transfer: {
        port: string;
        channel: string;
        from_chain_id: string;
        to_chain_id: string;
        pfm_enabled: boolean;
        supports_memo: boolean;
        denom_in: string;
        denom_out: string;
        bridge_id: string;
        smart_relay: boolean;
        chain_id: string;
        dest_denom: string;
      };
      tx_index: number;
      amount_in: string;
      amount_out: string;
    }
  ];
  slippage_tolerance_percent: string;
  address_list: string[];
  amount_in: string;
  amount_out: string;
  source_asset_denom: string;
  dest_asset_denom: string;
}
