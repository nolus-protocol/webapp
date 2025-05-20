export interface RouteRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  cumulative_affiliate_fee_bps: string;
  go_fast: boolean;
  smart_relay: boolean;
  allow_multi_tx: boolean;
  allow_unsafe: boolean;
  swap_venues: {
    name: string;
    chain_id: string;
  }[];
  experimental_features: string[];
  smart_swap_options: {
    split_routes: boolean;
    evm_swaps: boolean;
  };
  amount_out?: string;
  amount_in?: string;
}
