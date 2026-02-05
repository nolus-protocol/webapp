//! Transaction enrichment handler
//!
//! Fetches raw transactions from ETL and decodes the base64-encoded protobuf
//! `value` field into structured `data` for the frontend.

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use prost::Message;
use tracing::debug;

use cosmrs::proto::cosmos::bank::v1beta1::MsgSend;
use cosmrs::proto::cosmos::distribution::v1beta1::MsgWithdrawDelegatorReward;
use cosmrs::proto::cosmos::gov::v1beta1::MsgVote;
use cosmrs::proto::cosmos::staking::v1beta1::{MsgBeginRedelegate, MsgDelegate, MsgUndelegate};
use cosmrs::proto::cosmwasm::wasm::v1::MsgExecuteContract;
use cosmrs::proto::ibc::applications::transfer::v1::MsgTransfer;
use cosmrs::proto::ibc::core::channel::v1::MsgRecvPacket;

use crate::error::AppError;
use crate::handlers::etl_proxy::ProxyQuery;
use crate::AppState;

/// Enriched transaction handler
///
/// Fetches raw transactions from ETL, decodes protobuf `value` fields,
/// and returns transactions with a `data` field containing decoded message fields.
pub async fn get_enriched_transactions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    let base_url = &state.config.external.etl_api_url;

    let mut params: Vec<String> = Vec::new();
    for param_name in &["address", "skip", "limit", "filter", "to"] {
        if let Some(value) = query.params.get(*param_name) {
            params.push(format!("{}={}", param_name, urlencoding::encode(value)));
        }
    }

    let url = if params.is_empty() {
        format!("{}/api/txs", base_url)
    } else {
        format!("{}/api/txs?{}", base_url, params.join("&"))
    };

    debug!("Fetching transactions for enrichment from {}", url);

    let response = state
        .etl_client
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ExternalApi {
            api: "ETL".to_string(),
            message: format!("Request failed: {}", e),
        })?;

    let raw_txs: Vec<serde_json::Value> = response.json().await.map_err(|e| {
        AppError::Internal(format!("Failed to parse ETL transactions response: {}", e))
    })?;

    let user_address = query.params.get("address").cloned().unwrap_or_default();

    let enriched: Vec<serde_json::Value> = raw_txs
        .into_iter()
        .filter(|tx| is_user_transaction(tx))
        .map(|tx| enrich_transaction(tx, &user_address))
        .collect();

    Ok(Json(enriched))
}

/// User-initiated transaction types that the frontend can render.
/// System messages (IBC relay, client updates, acknowledgements) are filtered out.
const SUPPORTED_TX_TYPES: &[&str] = &[
    "/cosmos.bank.v1beta1.MsgSend",
    "/ibc.applications.transfer.v1.MsgTransfer",
    "/cosmwasm.wasm.v1.MsgExecuteContract",
    "/cosmos.gov.v1beta1.MsgVote",
    "/cosmos.staking.v1beta1.MsgDelegate",
    "/cosmos.staking.v1beta1.MsgUndelegate",
    "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    "/cosmos.staking.v1beta1.MsgBeginRedelegate",
    "/ibc.core.channel.v1.MsgRecvPacket",
];

/// Check if a transaction is a user-initiated type
fn is_user_transaction(tx: &serde_json::Value) -> bool {
    tx.get("type")
        .and_then(|v| v.as_str())
        .map(|t| SUPPORTED_TX_TYPES.contains(&t))
        .unwrap_or(false)
}

/// Insert a decoded `data` field into a transaction JSON object.
/// Preserves all original flat fields from ETL.
/// For IBC transactions, adds `is_swap` by comparing the counterparty address
/// with the user's address (same bech32 data = transfer, different = swap).
fn enrich_transaction(mut tx: serde_json::Value, user_address: &str) -> serde_json::Value {
    if let Some(obj) = tx.as_object_mut() {
        let tx_type = obj.get("type").and_then(|v| v.as_str()).map(String::from);
        let value = obj.get("value").and_then(|v| v.as_str()).map(String::from);

        if let (Some(tx_type), Some(value_b64)) = (tx_type, value) {
            match decode_message(&tx_type, &value_b64) {
                Some(data) => {
                    obj.insert("data".to_string(), data);
                }
                None => {
                    debug!("Could not decode tx value for type: {}", tx_type);
                }
            }

            // Detect swap vs transfer for IBC transactions
            if let Some(is_swap) = detect_is_swap(&tx_type, obj, user_address) {
                obj.insert("is_swap".to_string(), serde_json::Value::Bool(is_swap));
            }
        }
    }
    tx
}

/// Detect whether an IBC transaction is a swap or a direct transfer.
///
/// Compares the bech32 address data (the part between the separator and checksum)
/// of the user and the counterparty. Same data = same key on different chain = transfer.
/// Different data = Skip/DEX intermediate address = swap.
fn detect_is_swap(
    tx_type: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
    user_address: &str,
) -> Option<bool> {
    let user_data = bech32_data_part(user_address)?;

    match tx_type {
        "/ibc.applications.transfer.v1.MsgTransfer" => {
            // Outbound: compare user with receiver
            let receiver = obj
                .get("data")
                .and_then(|d| d.get("receiver"))
                .and_then(|v| v.as_str())?;
            let receiver_data = bech32_data_part(receiver)?;
            Some(user_data != receiver_data)
        }
        "/ibc.core.channel.v1.MsgRecvPacket" => {
            // Inbound: parse packet.data JSON, compare user with sender
            let packet_data_str = obj
                .get("data")
                .and_then(|d| d.get("packet"))
                .and_then(|p| p.get("data"))
                .and_then(|v| v.as_str())?;
            let packet_data: serde_json::Value = serde_json::from_str(packet_data_str).ok()?;
            let sender = packet_data.get("sender").and_then(|v| v.as_str())?;
            let sender_data = bech32_data_part(sender)?;
            Some(user_data != sender_data)
        }
        _ => None,
    }
}

/// Extract the bech32 data part from an address (between the `1` separator and the last 6 checksum chars).
/// Same-key addresses across Cosmos chains share this data part.
fn bech32_data_part(addr: &str) -> Option<&str> {
    let sep = addr.find('1')?;
    let data = &addr[sep + 1..];
    if data.len() <= 6 {
        return None;
    }
    Some(&data[..data.len() - 6])
}

/// Decode a protobuf message based on its type URL.
/// Returns a JSON object with camelCase field names matching what the frontend expects.
/// Returns None if the type is unknown or decoding fails.
fn decode_message(type_url: &str, value_b64: &str) -> Option<serde_json::Value> {
    let bytes = BASE64.decode(value_b64).ok()?;

    match type_url {
        "/cosmos.bank.v1beta1.MsgSend" => {
            let msg = MsgSend::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "fromAddress": msg.from_address,
                "toAddress": msg.to_address,
                "amount": coin_list(&msg.amount)
            }))
        }
        "/ibc.applications.transfer.v1.MsgTransfer" => {
            let msg = MsgTransfer::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "sender": msg.sender,
                "receiver": msg.receiver,
                "token": msg.token.map(|t| serde_json::json!({
                    "denom": t.denom,
                    "amount": t.amount
                })),
                "sourcePort": msg.source_port,
                "sourceChannel": msg.source_channel
            }))
        }
        "/cosmwasm.wasm.v1.MsgExecuteContract" => {
            let msg = MsgExecuteContract::decode(bytes.as_slice()).ok()?;
            // msg.msg is Vec<u8> containing JSON bytes — send as UTF-8 string
            // Frontend does: JSON.parse(Buffer.from(msg.data.msg).toString())
            let msg_str = String::from_utf8(msg.msg).ok()?;
            Some(serde_json::json!({
                "sender": msg.sender,
                "contract": msg.contract,
                "msg": msg_str,
                "funds": coin_list(&msg.funds)
            }))
        }
        "/cosmos.gov.v1beta1.MsgVote" => {
            let msg = MsgVote::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "voter": msg.voter,
                "proposalId": msg.proposal_id,
                "option": msg.option
            }))
        }
        "/cosmos.staking.v1beta1.MsgDelegate" => {
            let msg = MsgDelegate::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "delegatorAddress": msg.delegator_address,
                "validatorAddress": msg.validator_address,
                "amount": msg.amount.map(|c| serde_json::json!({
                    "denom": c.denom,
                    "amount": c.amount
                }))
            }))
        }
        "/cosmos.staking.v1beta1.MsgUndelegate" => {
            let msg = MsgUndelegate::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "delegatorAddress": msg.delegator_address,
                "validatorAddress": msg.validator_address,
                "amount": msg.amount.map(|c| serde_json::json!({
                    "denom": c.denom,
                    "amount": c.amount
                }))
            }))
        }
        "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward" => {
            let msg = MsgWithdrawDelegatorReward::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "delegatorAddress": msg.delegator_address,
                "validatorAddress": msg.validator_address
            }))
        }
        "/cosmos.staking.v1beta1.MsgBeginRedelegate" => {
            let msg = MsgBeginRedelegate::decode(bytes.as_slice()).ok()?;
            Some(serde_json::json!({
                "delegatorAddress": msg.delegator_address,
                "validatorSrcAddress": msg.validator_src_address,
                "validatorDstAddress": msg.validator_dst_address,
                "amount": msg.amount.map(|c| serde_json::json!({
                    "denom": c.denom,
                    "amount": c.amount
                }))
            }))
        }
        "/ibc.core.channel.v1.MsgRecvPacket" => {
            let msg = MsgRecvPacket::decode(bytes.as_slice()).ok()?;
            msg.packet.and_then(|pkt| {
                // pkt.data is Vec<u8> containing JSON bytes — send as UTF-8 string
                // Frontend does: JSON.parse(Buffer.from(msg.data.packet.data).toString())
                let data_str = String::from_utf8(pkt.data).ok()?;
                Some(serde_json::json!({
                    "packet": {
                        "data": data_str,
                        "sourcePort": pkt.source_port,
                        "sourceChannel": pkt.source_channel,
                        "destinationPort": pkt.destination_port,
                        "destinationChannel": pkt.destination_channel
                    }
                }))
            })
        }
        _ => {
            debug!("Unknown transaction type for decoding: {}", type_url);
            None
        }
    }
}

/// Helper to convert a slice of proto Coin to JSON array
fn coin_list(coins: &[cosmrs::proto::cosmos::base::v1beta1::Coin]) -> serde_json::Value {
    serde_json::json!(coins
        .iter()
        .map(|c| serde_json::json!({
            "denom": c.denom,
            "amount": c.amount
        }))
        .collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;
    use prost::Message;

    #[test]
    fn test_decode_msg_send() {
        let msg = MsgSend {
            from_address: "nolus1sender".to_string(),
            to_address: "nolus1receiver".to_string(),
            amount: vec![cosmrs::proto::cosmos::base::v1beta1::Coin {
                denom: "unls".to_string(),
                amount: "1000000".to_string(),
            }],
        };
        let mut buf = Vec::new();
        msg.encode(&mut buf).unwrap();
        let b64 = BASE64.encode(&buf);

        let result = decode_message("/cosmos.bank.v1beta1.MsgSend", &b64);
        assert!(result.is_some());
        let data = result.unwrap();
        assert_eq!(data["fromAddress"], "nolus1sender");
        assert_eq!(data["toAddress"], "nolus1receiver");
        assert_eq!(data["amount"][0]["denom"], "unls");
        assert_eq!(data["amount"][0]["amount"], "1000000");
    }

    #[test]
    fn test_decode_msg_delegate() {
        let msg = MsgDelegate {
            delegator_address: "nolus1delegator".to_string(),
            validator_address: "nolusvaloper1validator".to_string(),
            amount: Some(cosmrs::proto::cosmos::base::v1beta1::Coin {
                denom: "unls".to_string(),
                amount: "500000".to_string(),
            }),
        };
        let mut buf = Vec::new();
        msg.encode(&mut buf).unwrap();
        let b64 = BASE64.encode(&buf);

        let result = decode_message("/cosmos.staking.v1beta1.MsgDelegate", &b64);
        assert!(result.is_some());
        let data = result.unwrap();
        assert_eq!(data["delegatorAddress"], "nolus1delegator");
        assert_eq!(data["validatorAddress"], "nolusvaloper1validator");
        assert_eq!(data["amount"]["denom"], "unls");
    }

    #[test]
    fn test_decode_msg_withdraw_reward() {
        let msg = MsgWithdrawDelegatorReward {
            delegator_address: "nolus1delegator".to_string(),
            validator_address: "nolusvaloper1validator".to_string(),
        };
        let mut buf = Vec::new();
        msg.encode(&mut buf).unwrap();
        let b64 = BASE64.encode(&buf);

        let result = decode_message(
            "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
            &b64,
        );
        assert!(result.is_some());
        let data = result.unwrap();
        assert_eq!(data["delegatorAddress"], "nolus1delegator");
        assert_eq!(data["validatorAddress"], "nolusvaloper1validator");
    }

    #[test]
    fn test_decode_msg_execute_contract() {
        let msg = MsgExecuteContract {
            sender: "nolus1sender".to_string(),
            contract: "nolus1contract".to_string(),
            msg: b"{\"deposit\":[]}".to_vec(),
            funds: vec![cosmrs::proto::cosmos::base::v1beta1::Coin {
                denom: "unls".to_string(),
                amount: "100".to_string(),
            }],
        };
        let mut buf = Vec::new();
        msg.encode(&mut buf).unwrap();
        let b64 = BASE64.encode(&buf);

        let result = decode_message("/cosmwasm.wasm.v1.MsgExecuteContract", &b64);
        assert!(result.is_some());
        let data = result.unwrap();
        assert_eq!(data["sender"], "nolus1sender");
        assert_eq!(data["contract"], "nolus1contract");
        // msg is a UTF-8 JSON string (not base64)
        assert_eq!(data["msg"], "{\"deposit\":[]}");
        assert_eq!(data["funds"][0]["denom"], "unls");
    }

    #[test]
    fn test_decode_unknown_type_returns_none() {
        let result = decode_message("/some.unknown.v1.MsgFoo", "AAAA");
        assert!(result.is_none());
    }

    #[test]
    fn test_decode_invalid_base64_returns_none() {
        let result = decode_message("/cosmos.bank.v1beta1.MsgSend", "not-valid-base64!!!");
        assert!(result.is_none());
    }

    #[test]
    fn test_enrich_preserves_flat_fields() {
        let tx = serde_json::json!({
            "block": 12345,
            "tx_hash": "ABC123",
            "from": "nolus1sender",
            "to": "nolus1receiver",
            "type": "/some.unknown.v1.Msg",
            "value": "AAAA",
            "rewards": "1000unls",
            "timestamp": "2025-01-15T10:30:00Z"
        });
        let enriched = enrich_transaction(tx, "nolus1sender");
        assert_eq!(enriched["block"], 12345);
        assert_eq!(enriched["tx_hash"], "ABC123");
        assert_eq!(enriched["from"], "nolus1sender");
        assert_eq!(enriched["rewards"], "1000unls");
        assert_eq!(enriched["timestamp"], "2025-01-15T10:30:00Z");
    }

    #[test]
    fn test_bech32_data_part() {
        // Same key, different chains — data part matches
        assert_eq!(
            bech32_data_part("nolus1ncc58ptqrkd7r7uk60dx4eufvvqf2edhtktv0q"),
            bech32_data_part("neutron1ncc58ptqrkd7r7uk60dx4eufvvqf2edheej3hz")
        );
        // Different key — data part differs
        assert_ne!(
            bech32_data_part("nolus1ncc58ptqrkd7r7uk60dx4eufvvqf2edhtktv0q"),
            bech32_data_part("osmo1m8wg4vxkefhs374qxmmqpyusgz289wmulex5qdwpfx7jnrxzer5s9cv83q")
        );
        // Invalid address
        assert!(bech32_data_part("invalid").is_none());
        // Too short
        assert!(bech32_data_part("x1abcdef").is_none());
    }
}
