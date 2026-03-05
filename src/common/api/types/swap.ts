/**
 * Swap types - matches backend/src/handlers/swap.rs
 * Includes Skip Route API types
 */

// =========================================================================
// Skip Route API types
// =========================================================================

export interface SkipChain {
  chain_name: string;
  chain_id: string;
  chain_type: string;
  pfm_enabled?: boolean;
  cosmos_module_support?: unknown;
  supports_memo?: boolean;
  logo_uri?: string;
  bech32_prefix?: string;
  fee_assets?: unknown[];
  is_testnet?: boolean;
}

export interface SkipRouteRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in?: string;
  amount_out?: string;
  network?: string;
}

export interface SkipRouteResponse {
  amount_in: string;
  amount_out: string;
  operations: unknown[];
  chain_ids: string[];
  does_swap: boolean;
  estimated_amount_out?: string;
  swap_price_impact_percent?: string;
  estimated_fees?: SkipFee[];
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  revert?: boolean;
}

export interface SkipFee {
  amount: string;
  denom: string;
  chain_id: string;
}

export interface SkipMessagesRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in: string;
  amount_out: string;
  operations: unknown[];
  address_list: string[];
}

export interface SkipMessagesResponse {
  txs: SkipTx[];
}

export interface SkipTx {
  cosmos_tx?: {
    chain_id: string;
    msgs: SkipMsg[];
  };
  evm_tx?: {
    chain_id: string;
    to: string;
    data: string;
    value?: string;
    required_erc20_approvals?: unknown[];
  };
}

export interface SkipMsg {
  msg: string;
  msg_type_url: string;
}

export interface SkipStatusRequest {
  chain_id: string;
  tx_hash: string;
}

export interface SkipStatusResponse {
  state: string;
  error?: string;
  transfer_sequence?: SkipTransferSequence[];
}

export interface SkipTransferSequence {
  src_chain_id: string;
  dst_chain_id: string;
  state: string;
  packet_txs?: unknown;
}

export interface SkipTrackRequest {
  chain_id: string;
  tx_hash: string;
}

export interface SkipTrackResponse {
  tx_hash: string;
  explorer_link?: string;
}
