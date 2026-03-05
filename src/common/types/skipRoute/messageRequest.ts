export interface MessagesRequest {
  source_asset_chain_id: string;
  source_asset_denom: string;
  dest_asset_chain_id: string;
  dest_asset_denom: string;
  amount_in: string;
  amount_out: string;
  operations: unknown[];
  address_list: string[];
}
