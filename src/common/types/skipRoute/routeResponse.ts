export interface RouteResponse {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in: string;
  amount_out: string;
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
  chain_ids: string[];
  does_swap: boolean;
  estimated_amount_out: string;
  swap_price_impact_percent: string;
  swap_venues: {
    name: string;
    chain_id: string;
  }[];
  txs_required: number;
  usd_amount_in: string;
  usd_amount_out: string;
  estimated_fees: [];
  required_chain_addresses: string[];
  estimated_route_duration_seconds: number;
  revert?: boolean;
}
