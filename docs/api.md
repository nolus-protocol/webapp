# API Reference

Complete reference for the backend REST API and WebSocket protocol.

> **Implementation Status:** All endpoints documented below are implemented in the Rust backend (16 handler modules). The backend handles caching, rate limiting, and external API aggregation.

## Endpoint Summary

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Health | 2 | Health check, detailed status |
| Config | 2 | App config |
| Lease Config | 1 | Lease validation config (downpayment ranges, min_asset) |
| Swap Config | 1 | Skip API swap routing config |
| Governance Config | 1 | Hidden proposals |
| Locales | 1 | Translation files |
| Prices & Currencies | 4 | Prices, currencies, balances |
| **Gated Assets** | 3 | Deduplicated assets with Oracle prices |
| **Gated Networks** | 4 | Configured networks, pools |
| **Gated Protocols** | 3 | Configured protocols, currencies |
| Leases | 8 | Query, history, quote, open/close/repay/market-close |
| Earn | 6 | Pools, positions, stats, deposit/withdraw |
| Staking | 8 | Validators, positions, params, delegate/undelegate/redelegate/claim |
| Swap | 9 | Quote, execute, status, history, chains, route, messages, track |
| Governance | 10 | Proposals, tally, votes, params, pool, APR, accounts, denoms, node info |
| Referral | 7 | Validate, register, stats, rewards, payouts, referrals, assign |
| Zero-Interest | 7 | Config, eligibility, payments, campaigns |
| ETL Proxy | 26+ | All ETL endpoints + 4 batch endpoints |
| Admin Gated | 15+ | Currency display, network config, lease rules, swap/UI settings |
| Admin Translations | 12 | Sync, generate, approve, audit |
| Admin Cache | 2 | Stats, invalidate |
| WebSocket | 6 topics | prices, balances, leases, staking, tx_status, skip_tx |

## Base URL

- **Local**: `http://localhost:3000`
- **Production**: `https://api.nolus.io`

## Authentication

Most endpoints are public. Admin endpoints require authentication via `X-Admin-Key` header.

## Rate Limiting

Per-IP token bucket rate limiting via the `governor` crate. Each IP gets its own rate limiter on first request.

| Endpoint Type | Rate | Burst |
|---------------|------|-------|
| Read endpoints (standard) | 20 requests/second | 50 |
| Write endpoints (strict) | 2 requests/second | 5 |
| Admin endpoints | Same as strict | 5 |

**Implementation details:**
- Algorithm: Token bucket (replenishes at the configured rate, allows bursts up to the burst limit)
- Scope: Per-IP address (extracted from `ConnectInfo<SocketAddr>`)
- Exceeded: Returns HTTP 429 with no body
- No rate limit headers (`X-RateLimit-*`) are included in responses
- **Eviction**: Background task runs every 5 minutes, removing IPs inactive for 10+ minutes to prevent unbounded memory growth
- **Hot path**: Known IPs use a read lock + atomic timestamp update (no write lock contention)

---

## Health & Status

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 3600
}
```

---

## Configuration

### GET /api/config

Returns protocol configuration including contracts and network settings.

**Response:**
```json
{
  "protocols": {
    "OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "name": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "network": "OSMOSIS",
      "dex": "OSMOSIS",
      "contracts": {
        "leaser": "nolus1...",
        "lpp": "nolus1...",
        "oracle": "nolus1...",
        "profit": "nolus1..."
      }
    }
  },
  "networks": { ... },
  "lease_config": { ... }
}
```

**Cache-Control:** `max-age=3600`

### GET /api/leases/config/{protocol}

Returns lease validation configuration for a protocol. Merges static downpayment ranges from `lease-rules.json` with on-chain LeaserConfig data (`min_asset`, `min_transaction`).

**Response:**
```json
{
  "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
  "downpayment_ranges": {
    "OSMO": { "min": 10, "max": 50000 },
    "ATOM": { "min": 10, "max": 50000 }
  },
  "min_asset": { "amount": "15000000", "ticker": "USDC" },
  "min_transaction": { "amount": "1000000", "ticker": "USDC" }
}
```

**Data sources:**
- `downpayment_ranges` — from gated config file (`lease-rules.json`)
- `min_asset`, `min_transaction` — from on-chain LeaserConfig via `chain_client.get_leaser_config(leaser_address)`

### GET /api/swap/config

Returns Skip API swap routing configuration. Combines static swap settings with dynamic data from ETL (Cosmos network transfers) and gated network config (swap venues, chain IDs).

**Key behavior:**
- **Cosmos transfers** (OSMOSIS, NEUTRON) are built dynamically from ETL currency data — each currency's `bank_symbol`/`dex_symbol` per protocol, grouped by the protocol's network
- **Swap venues** come from `network-config.json` per-network `swap_venue` field (Osmosis, Neutron)
- **Swap currency tickers** (e.g., `"USDC_NOBLE"`) are resolved to IBC denoms at runtime via ETL data

**Response:**
```json
{
  "api_url": "https://api.skip.money",
  "blacklist": [],
  "slippage": 1,
  "gas_multiplier": 2,
  "fee": 35,
  "fee_address": "",
  "timeoutSeconds": "60",
  "swap_currency_osmosis": "ibc/F5FABF52B54E65064B57BF6DBD8E5FAD22CEE9F4B8A57ADBB20CCD0173AA72A4",
  "swap_currency_neutron": "ibc/18161D8E5AE003B02A681F5B83BAF0B32FDE905D25F0B22A40016A65810A1207",
  "swap_to_currency": "unls",
  "osmosis-poolmanager": "osmo14p4cu64dlwavj7kga4s3mj6xglucj9t358r5mz",
  "neutron-astroport": "neutron1war9ee549tt9rla54g56ca78y969l6239pang9",
  "swap_venues": [
    { "name": "osmosis-poolmanager", "chain_id": "osmosis-1" },
    { "name": "neutron-astroport", "chain_id": "neutron-1" }
  ],
  "transfers": {
    "OSMOSIS": {
      "currencies": [
        { "from": "unls", "to": "ibc/D9AFCECDD361D38302AA66EB3BAC23B95234832C51D12489DC451FA2B7C72782", "native": false },
        { "from": "ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518", "to": "uosmo", "native": false }
      ]
    },
    "NEUTRON": {
      "currencies": [
        { "from": "unls", "to": "ibc/...", "native": false }
      ]
    }
  }
}
```

**Response field details:**

| Field | Source | Description |
|-------|--------|-------------|
| `api_url`, `blacklist`, `slippage`, etc. | `swap-settings.json` | Static settings |
| `swap_currency_<network>` | Ticker resolved via ETL | IBC denom of the swap intermediate currency per network |
| `swap_to_currency` | Ticker resolved via ETL | IBC denom of the target swap currency (NLS) |
| `<venue-name>` (top-level) | `network-config.json` | Venue contract address |
| `swap_venues[]` | `network-config.json` | Venue name + chain_id (derived from network) |
| `transfers` | Dynamic from ETL | Per-network currency mappings (bank_symbol → dex_symbol) |

### GET /api/governance/hidden-proposals

Returns list of governance proposal IDs that should be hidden from the UI.

**Response:**
```json
{
  "hidden_ids": ["1", "5", "12"]
}
```

### GET /api/locales/{lang}

Returns translation messages for a language. Validates the language code and loads from the active locale files.

**Response:** Full locale JSON object with all translation keys.

---

## Prices

### GET /api/prices

Returns current prices for all assets.

**Response:**
```json
{
  "prices": {
    "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "ATOM",
      "price_usd": "9.45"
    }
  },
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Cache-Control:** `max-age=10`

---

## Currencies

### GET /api/currencies

Returns all supported currencies with metadata.

**Response:**
```json
[
  {
    "key": "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE",
    "symbol": "ATOM",
    "name": "Cosmos Hub",
    "decimal_digits": 6,
    "dex_symbol": "ATOM",
    "bank_symbol": "ibc/27394FB..."
  }
]
```

---

## Balances

### GET /api/balances

Returns balances for a wallet address.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Nolus wallet address |

**Example:** `GET /api/balances?address=nolus1abc...`

**Response:**
```json
{
  "balances": [
    {
      "key": "NLS@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "NLS",
      "denom": "unls",
      "amount": "1000000",
      "amount_usd": "10.50",
      "decimal_digits": 6
    }
  ],
  "total_value_usd": "1250.00"
}
```

---

## Gated Propagation API

The gated propagation system filters ETL/on-chain data so that only configured items are visible. See [backend_api_enrichments_and_proxy.md](./backend_api_enrichments_and_proxy.md) for full details.

### GET /api/assets

Returns deduplicated assets with Oracle prices from the network's primary protocol.

**Response:**
```json
{
  "assets": [
    {
      "ticker": "ATOM",
      "display": {
        "icon": "/assets/icons/currencies/ATOM.svg",
        "displayName": "Cosmos Hub",
        "shortName": "ATOM",
        "color": "#2E3148"
      },
      "price_usd": "4.52",
      "networks": ["OSMOSIS", "NEUTRON"],
      "protocols": ["OSMOSIS-OSMOSIS-USDC_NOBLE", "NEUTRON-ASTROPORT-USDC_NOBLE"]
    }
  ],
  "count": 26
}
```

### GET /api/assets/{ticker}

Returns a single asset with details about all networks/protocols it's available on.

### GET /api/networks/gated

Returns all configured networks.

**Response:**
```json
{
  "networks": [
    {
      "network": "NEUTRON",
      "name": "Neutron",
      "chain_id": "neutron-1",
      "prefix": "neutron",
      "rpc": "https://rpc-lb.neutron.org",
      "lcd": "https://rest-lb.neutron.org",
      "gas_price": "0.025untrn",
      "explorer": "https://www.mintscan.io/neutron",
      "icon": "/icons/networks/neutron.svg",
      "estimation": 20
    }
  ],
  "count": 3
}
```

### GET /api/networks/{network}/info

Returns details for a single network.

### GET /api/networks/{network}/assets

Returns assets available on a specific network.

### GET /api/networks/{network}/protocols

Returns protocols available on a specific network.

### GET /api/networks/{network}/pools

Returns LPP earn pools on a specific network.

### GET /api/protocols/gated

Returns all configured protocols.

**Response:**
```json
{
  "protocols": [
    {
      "protocol": "NEUTRON-ASTROPORT-USDC_NOBLE",
      "network": "Neutron",
      "dex": "Astroport",
      "position_type": "Long",
      "lpn": "USDC_NOBLE",
      "lpn_display": {
        "ticker": "USDC_NOBLE",
        "icon": "/assets/icons/currencies/USDC_NOBLE.svg",
        "displayName": "Noble USDC",
        "shortName": "USDC",
        "color": "#2775CA"
      },
      "contracts": {
        "leaser": "nolus1...",
        "lpp": "nolus1...",
        "oracle": "nolus1...",
        "profit": "nolus1..."
      }
    }
  ],
  "count": 7
}
```

### GET /api/protocols/{protocol}/currencies

Returns currencies for a specific protocol with Oracle prices.

**Response:**
```json
{
  "currencies": [
    {
      "ticker": "ATOM",
      "denom": "ibc/27394...",
      "decimals": 6,
      "display": {
        "icon": "/assets/icons/currencies/ATOM.svg",
        "displayName": "Cosmos Hub",
        "shortName": "ATOM",
        "color": "#2E3148"
      },
      "price_usd": "4.52"
    }
  ],
  "count": 7
}
```

---

## Leases

### GET /api/leases

Returns all leases for an owner.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner` | string | Yes | Owner wallet address |
| `protocol` | string | No | Filter by protocol |

**Example:** `GET /api/leases?owner=nolus1abc...`

**Response:**
```json
{
  "leases": [
    {
      "address": "nolus1lease...",
      "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "owner": "nolus1abc...",
      "status": "opened",
      "amount": {
        "ticker": "ATOM",
        "amount": "100000000"
      },
      "debt": {
        "total": "500000000",
        "interest": "5000000"
      },
      "pnl": {
        "amount": "0",
        "percent": "0",
        "downpayment": "15.00"
      }
    }
  ],
  "total_collateral_usd": "1000.00",
  "total_debt_usd": "500.00"
}
```

**Note:** The `pnl.amount` and `pnl.percent` fields are always `"0"` — the ETL `ls-opening` endpoint doesn't provide a PnL value, and the backend doesn't calculate it. PnL is computed on the frontend by `LeaseCalculator.calculatePnl()` using current asset value, debt, and the `pnl.downpayment` field.

**In-progress states:** Opened leases may include an `in_progress` field indicating an ongoing operation. The backend parses the chain contract's `status` sub-field into a discriminated union:

| `in_progress` variant | Description |
|---|---|
| `{"opening": {"stage": "..."}}` | Lease is opening (stages: `open_ica_account`, `transfer_out`, `buy_asset`) |
| `{"repayment": {}}` | Repayment transaction in progress |
| `{"close": {}}` | Close operation in progress |
| `{"liquidation": {"cause": "overdue"}}` | Liquidation in progress (cause: `overdue` or `liability`) |
| `{"slippage_protection": {}}` | Market Anomaly Guard (MAG) activated — actions blocked until resolved |

When `in_progress` is present, the frontend disables Repay/Close/Stop Loss/Take Profit buttons and shows an appropriate status banner.

### GET /api/leases/:address

Returns details for a specific lease.

**Response:** Same as single lease object above, with full `protocol` field included in the response.

### GET /api/leases/:address/history

Returns transaction history for a lease.

**Response:**
```json
{
  "history": [
    {
      "action": "open",
      "timestamp": "2024-01-10T10:00:00Z",
      "tx_hash": "ABC123...",
      "amount": "100000000",
      "symbol": "ATOM"
    }
  ]
}
```

---

## Earn

### GET /api/earn/pools

Returns all earn pools.

**Response:**
```json
[
  {
    "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
    "lpp_address": "nolus1...",
    "apy": 12.5,
    "total_deposited": "1000000000000",
    "total_deposited_usd": "1000000.00",
    "utilization": "75.5",
    "min_deposit": "1000000"
  }
]
```

### GET /api/earn/positions

Returns earn positions for an owner.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Owner wallet address |

**Response:**
```json
{
  "positions": [
    {
      "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "deposited_nlpn": "1000000000",
      "deposited_lpn": "1050000000",
      "deposited_usd": "1050.00",
      "lpp_price": "1.05",
      "current_apy": 12.5
    }
  ],
  "total_deposited_usd": "1050.00"
}
```

### GET /api/earn/stats

Returns overall earn statistics.

**Response:**
```json
{
  "total_value_locked": "10000000.00",
  "pools_count": 8,
  "average_apy": 11.2,
  "dispatcher_rewards": 0.05
}
```

---

## Staking

### GET /api/staking/validators

Returns all validators.

**Response:**
```json
[
  {
    "operator_address": "nolusvaloper1...",
    "moniker": "Validator Name",
    "identity": "ABCD1234",
    "website": "https://example.com",
    "description": "A validator",
    "commission_rate": "0.050000000000000000",
    "max_commission_rate": "0.200000000000000000",
    "max_commission_change_rate": "0.010000000000000000",
    "tokens": "1000000000",
    "delegator_shares": "1000000000.000000000000000000",
    "unbonding_height": "0",
    "unbonding_time": "1970-01-01T00:00:00Z",
    "status": "bonded",
    "jailed": false
  }
]
```

### GET /api/staking/positions

Returns staking positions for a delegator.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Delegator wallet address |

**Response:**
```json
{
  "delegations": [
    {
      "validator_address": "nolusvaloper1...",
      "validator_moniker": "Validator Name",
      "shares": "1000000000",
      "balance": {
        "denom": "unls",
        "amount": "1000000000"
      }
    }
  ],
  "rewards": [
    {
      "validator_address": "nolusvaloper1...",
      "rewards": [
        { "denom": "unls", "amount": "50000" }
      ]
    }
  ],
  "total_staked": "1000000000",
  "total_rewards": "50000"
}
```

---

## Governance

### GET /api/governance/proposals

Returns governance proposals.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |

**Response:**
```json
{
  "proposals": [
    {
      "id": "1",
      "title": "Proposal Title",
      "description": "...",
      "status": "PROPOSAL_STATUS_VOTING_PERIOD",
      "voting_end_time": "2024-01-20T10:00:00Z",
      "tally": {
        "yes": "1000000",
        "no": "500000",
        "abstain": "100000",
        "no_with_veto": "50000"
      }
    }
  ]
}
```

---

## Swap

All swap endpoints proxy to the Skip API (`https://api.skip.money`). The backend passes request/response JSON through as-is, only adding error handling and logging.

### POST /api/swap/route

Get swap route quote from Skip.

**Request Body:** Passed through to Skip `/v2/fungible/route`

### POST /api/swap/messages

Get executable messages for a swap route. Passed through to Skip `/v2/fungible/msgs`.

### POST /api/swap/track

Track an in-flight swap transaction. Passed through to Skip `/v2/tx/track`.

### GET /api/swap/status

Get swap transaction status. Passed through to Skip `/v2/tx/status` as JSON (not query params).

### POST /api/swap/chains

Get supported chains. Passed through to Skip `/v2/info/chains`.

### POST /api/swap/execute

Execute a swap transaction via the backend.

---

## Referral Program

Endpoints for the referral program. Users can register as referrers and earn rewards when their referrals use the platform.

For detailed documentation, see [REFERRAL_PROGRAM.md](./REFERRAL_PROGRAM.md).

### GET /api/referral/validate/:code

Validate a referral code (public, no auth required).

**Response:**
```json
{
  "valid": true,
  "referral_code": "NLS-X7K3P2",
  "referrer_wallet": "nolus1abc..."
}
```

### POST /api/referral/register

Register as a referrer.

**Request Body:**
```json
{
  "wallet_address": "nolus1abc..."
}
```

**Response:**
```json
{
  "wallet_address": "nolus1abc...",
  "referral_code": "NLS-X7K3P2",
  "tier": "general",
  "created_at": "2026-01-15T10:00:00Z",
  "already_registered": false
}
```

### GET /api/referral/stats/:address

Get referrer info and statistics.

**Response:**
```json
{
  "referrer": {
    "wallet_address": "nolus1abc...",
    "referral_code": "NLS-X7K3P2",
    "tier": "general",
    "status": "active",
    "created_at": "2026-01-10T08:00:00Z"
  },
  "stats": {
    "total_referrals": 15,
    "active_referrals": 12,
    "total_rewards_earned": "250000000",
    "total_rewards_paid": "200000000",
    "pending_rewards": "50000000",
    "rewards_denom": "unls",
    "bonus_rewards_earned": 2,
    "bonus_rewards_paid": 1,
    "total_bonus_amount_earned": "5000000000",
    "total_bonus_amount_paid": "1000000000"
  }
}
```

### GET /api/referral/referrals/:address

Get list of referred users.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`active`, `inactive`) |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "referrals": [
    {
      "id": 1,
      "referred_wallet": "nolus1xyz...",
      "assigned_at": "2026-01-12T10:00:00Z",
      "status": "active"
    }
  ],
  "total": 15,
  "limit": 100,
  "offset": 0
}
```

### GET /api/referral/rewards/:address

Get rewards history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`pending`, `included`, `paid`) |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "rewards": [
    {
      "id": 123,
      "lease_id": "nolus1lease...",
      "referred_wallet": "nolus1xyz...",
      "period_start": "2026-01-14T00:00:00Z",
      "period_end": "2026-01-15T00:00:00Z",
      "interest_collected": "1000000",
      "interest_denom": "uusdc",
      "reward_amount": "40000",
      "reward_denom": "unls",
      "status": "paid",
      "created_at": "2026-01-15T01:00:00Z"
    }
  ],
  "total": 50,
  "limit": 50,
  "offset": 0
}
```

### GET /api/referral/payouts/:address

Get payout history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`pending`, `submitted`, `confirmed`, `failed`) |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "payouts": [
    {
      "id": 5,
      "total_amount": "150000000",
      "denom": "unls",
      "tx_hash": "ABC123...",
      "status": "confirmed",
      "created_at": "2026-01-14T00:00:00Z",
      "executed_at": "2026-01-14T00:05:00Z"
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

### POST /api/referral/assign

Assign a referral (link referred wallet to referrer).

**Request Body:**
```json
{
  "referral_code": "NLS-X7K3P2",
  "referred_wallet": "nolus1xyz..."
}
```

**Response:**
```json
{
  "id": 42,
  "referrer_wallet": "nolus1abc...",
  "referred_wallet": "nolus1xyz...",
  "referral_code": "NLS-X7K3P2",
  "assigned_at": "2026-01-15T10:30:00Z"
}
```

---

## ETL Proxy

The backend proxies requests to the ETL API. All endpoints are prefixed with `/api/etl/`.

### Enriched Endpoints

#### GET /api/etl/txs

Returns enriched transaction history for an address. Unlike raw ETL proxy endpoints, `/txs` decodes protobuf message data and filters out system transactions (IBC relay, client updates).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Wallet address |
| `skip` | number | No | Pagination offset (default: 0) |
| `limit` | number | No | Max results (default: 50) |

**Example:** `GET /api/etl/txs?address=nolus1abc...&skip=0&limit=10`

**Response:**
```json
[
  {
    "block": 12345,
    "code": 0,
    "fee_amount": "500",
    "fee_denom": "unls",
    "from": "nolus1abc...",
    "to": "nolus1xyz...",
    "tx_hash": "ABC123...",
    "type": "/cosmos.bank.v1beta1.MsgSend",
    "timestamp": "2025-01-15T10:30:00Z",
    "rewards": null,
    "data": {
      "fromAddress": "nolus1abc...",
      "toAddress": "nolus1xyz...",
      "amount": [{ "denom": "unls", "amount": "1000000" }]
    }
  },
  {
    "block": 12350,
    "code": 0,
    "from": "nolus1abc...",
    "to": "osmo1xyz...",
    "tx_hash": "DEF456...",
    "type": "/ibc.applications.transfer.v1.MsgTransfer",
    "timestamp": "2025-01-15T11:00:00Z",
    "is_swap": true,
    "data": {
      "sender": "nolus1abc...",
      "receiver": "osmo1xyz...",
      "token": { "denom": "unls", "amount": "500000" },
      "sourcePort": "transfer",
      "sourceChannel": "channel-0"
    }
  }
]
```

**Enrichment Details:**
- The `data` field is decoded from the ETL `value` (base64 protobuf) field
- Fields are camelCase to match frontend expectations
- For `MsgExecuteContract`, the `msg` field is a UTF-8 JSON string (not base64)
- For `MsgRecvPacket`, the `packet.data` field is a UTF-8 JSON string
- Unknown message types are included without a `data` field (graceful degradation)
- System transactions (IBC relay, client updates, acknowledgements) are filtered out
- For IBC messages (`MsgTransfer`, `MsgRecvPacket`), an `is_swap` boolean field is added. It compares bech32 address data between user and counterparty: `true` if different keys (routed through DEX), `false` if same key (direct IBC transfer)

**Supported Message Types:**

| Type URL | `data` fields |
|----------|---------------|
| `/cosmos.bank.v1beta1.MsgSend` | `fromAddress`, `toAddress`, `amount[]` |
| `/ibc.applications.transfer.v1.MsgTransfer` | `sender`, `receiver`, `token`, `sourcePort`, `sourceChannel` |
| `/cosmwasm.wasm.v1.MsgExecuteContract` | `sender`, `contract`, `msg` (JSON string), `funds[]` |
| `/cosmos.gov.v1beta1.MsgVote` | `voter`, `proposalId`, `option` |
| `/cosmos.staking.v1beta1.MsgDelegate` | `delegatorAddress`, `validatorAddress`, `amount` |
| `/cosmos.staking.v1beta1.MsgUndelegate` | `delegatorAddress`, `validatorAddress`, `amount` |
| `/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward` | `delegatorAddress`, `validatorAddress` |
| `/cosmos.staking.v1beta1.MsgBeginRedelegate` | `delegatorAddress`, `validatorSrcAddress`, `validatorDstAddress`, `amount` |
| `/ibc.core.channel.v1.MsgRecvPacket` | `packet: { data, sourcePort, sourceChannel, destinationPort, destinationChannel }` |

### Other Individual Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/etl/pools` | Pool data with APY |
| `GET /api/etl/prices?interval=&key=&protocol=` | Price time series (raw proxy) |
| `GET /api/etl/total-value-locked` | TVL data |
| `GET /api/etl/pnl-over-time?address=&interval=` | PnL history (raw proxy) |
| `GET /api/etl/ls-opening?lease=` | Lease opening data |
| `GET /api/etl/realized-pnl?address=` | Realized PnL |

#### GET /api/etl/prices

Returns price time series for a specific asset and protocol. This is a raw ETL proxy — the response is passed through as-is.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Asset ticker (e.g., `ATOM`) |
| `protocol` | string | Yes | Protocol name (e.g., `OSMOSIS-OSMOSIS-USDC_NOBLE`) |
| `interval` | string | Yes | Interval in days as numeric string (e.g., `1`, `7`, `30`) |

**Response:** Raw array of `[timestamp, price]` tuples:
```json
[
  [1706745600, 9.45],
  [1706832000, 9.52],
  [1706918400, 9.38]
]
```

#### GET /api/etl/pnl-over-time

Returns PnL history for a specific lease. This is a raw ETL proxy.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Lease address |
| `interval` | string | Yes | Interval in days as numeric string (e.g., `1`, `7`, `30`) |

**Response:** Raw array of PnL data points:
```json
[
  { "amount": "5.23", "date": "2026-01-15" },
  { "amount": "7.81", "date": "2026-01-16" },
  { "amount": "3.42", "date": "2026-01-17" }
]
```

Note: `amount` is a string, not a number.

### Batch Endpoints

Batch endpoints fetch multiple resources in parallel for better performance.

#### GET /api/etl/batch/stats-overview

Returns TVL, transaction volume, buyback total, realized PnL stats, and revenue.

**Response:**
```json
{
  "tvl": { "total_value_locked": "10000000" },
  "tx_volume": { "total_tx_value": "5000000" },
  "buyback_total": { "buyback_total": "100000" },
  "realized_pnl_stats": { "amount": "50000" },
  "revenue": { "revenue": "25000" }
}
```

#### GET /api/etl/batch/loans-stats

Returns open position value and open interest.

**Response:**
```json
{
  "open_position_value": { "open_position_value": "2000000" },
  "open_interest": { "open_interest": "1500000" }
}
```

#### GET /api/etl/batch/user-dashboard?address=

Returns earnings, realized PnL, and position debt value for a user.

#### GET /api/etl/batch/user-history?address=

Returns history stats and realized PnL data for a user.

---

## WebSocket Protocol

### Connection

```
ws://localhost:3000/ws
```

### Message Format

All messages are JSON with a `type` field.

### Client → Server Messages

#### Subscribe
```json
{
  "type": "subscribe",
  "topic": "prices"
}
```

With parameters:
```json
{
  "type": "subscribe",
  "topic": "leases",
  "address": "nolus1..."
}
```

#### Unsubscribe
```json
{
  "type": "unsubscribe",
  "topic": "prices"
}
```

#### Ping
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Subscribed
```json
{
  "type": "subscribed",
  "topic": "prices"
}
```

#### Pong
```json
{
  "type": "pong"
}
```

#### Price Update
```json
{
  "type": "price_update",
  "prices": {
    "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "...",
      "symbol": "ATOM",
      "price_usd": "9.45"
    }
  }
}
```

#### Balance Update
```json
{
  "type": "balance_update",
  "address": "nolus1...",
  "balances": [...]
}
```

#### Lease Update
```json
{
  "type": "lease_update",
  "lease": { ... }
}
```

#### Transaction Status
```json
{
  "type": "tx_status",
  "tx_hash": "ABC123...",
  "status": "success"
}
```

### Subscription Topics

| Topic | Parameters | Description |
|-------|------------|-------------|
| `prices` | None | Real-time price updates |
| `balances` | `address` | Balance updates for address |
| `leases` | `address` | Lease updates for owner |
| `tx_status` | `hash`, `chain_id` | Transaction status |
| `staking` | `address` | Staking position updates |
| `skip_tx` | `tx_hash`, `source_chain` | Skip swap progress |

### Example: JavaScript Client

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Subscribe to prices
  ws.send(JSON.stringify({ type: 'subscribe', topic: 'prices' }));
  
  // Subscribe to leases for a specific address
  ws.send(JSON.stringify({ 
    type: 'subscribe', 
    topic: 'leases',
    address: 'nolus1...'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'price_update':
      console.log('New prices:', msg.prices);
      break;
    case 'lease_update':
      console.log('Lease updated:', msg.lease);
      break;
  }
};
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Human readable message",
  "details": { ... }  // Optional additional context
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (admin endpoints) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 502 | External API error |
| 503 | Service unavailable (cache not ready) |

### Error Types

| Error | Description |
|-------|-------------|
| `Validation` | Invalid input parameters |
| `NotFound` | Resource doesn't exist |
| `ExternalApi` | External API call failed |
| `ServiceUnavailable` | Cache not yet populated (cold start or refresh failure) |
| `Internal` | Server error |

### Cold Start Behavior (HTTP 503)

On server startup, the backend runs `warm_essential_data()` to populate critical caches before accepting requests. If warm-up partially fails (e.g., chain node is unreachable), the server starts anyway but affected endpoints return **HTTP 503** until the next background refresh succeeds.

Endpoints that may return 503:
- `GET /api/config` — requires `app_config` cache
- `GET /api/prices` — requires `prices` cache
- `GET /api/currencies` — requires `currencies` cache
- `GET /api/assets` — requires `gated_assets` cache
- `GET /api/protocols/gated` — requires `gated_protocols` cache
- `GET /api/networks/gated` — requires `gated_networks` cache
- `GET /api/staking/validators` — requires `validators` cache
- `GET /api/earn/pools` — requires `pools` cache
- `GET /api/swap/config` — requires `swap_config` cache
- `GET /api/etl/batch/stats-overview` — requires `stats_overview` cache
- `GET /api/etl/batch/loans-stats` — requires `loans_stats` cache

The 503 response follows the standard error format:
```json
{
  "error": "ServiceUnavailable",
  "message": "Data not yet available, please retry shortly"
}
```

Background refresh tasks run on fixed intervals (15s–300s depending on data type) and will populate the cache as soon as the upstream source becomes available. The frontend already handles transient errors with retry logic.

---

## Intercom

### POST /api/intercom/hash

Generate a JWT token for Intercom identity verification. This allows secure user identification in the Intercom messenger widget.

**Note:** This endpoint replaces the previous beacon service dependency. The webapp backend now generates JWT tokens directly.

**Request Body:**
```json
{
  "wallet": "nolus1abc..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Token Details:**
- Algorithm: HS256
- Payload: `{ user_id: "<wallet>", exp: <timestamp> }`
- Expiration: 1 hour from generation

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Empty wallet address |
| 500 | Intercom secret key not configured |

---

## Zero-Interest Campaigns

Endpoints for checking zero-interest campaign eligibility. Data is sourced from the Payments Manager service.

For detailed documentation, see [ZERO_INTEREST_CAMPAIGNS.md](./ZERO_INTEREST_CAMPAIGNS.md).

### GET /api/campaigns/active

Returns all currently active zero-interest campaigns with their eligibility rules.

**Response:**
```json
{
  "campaigns": [
    {
      "id": 1,
      "name": "BTC Winter Campaign",
      "active": true,
      "eligible_protocols": ["nolus1leaser..."],
      "eligible_currencies": ["ALL_BTC"],
      "eligible_wallets": [],
      "start_date": "2026-01-01T00:00:00Z",
      "end_date": "2026-03-31T23:59:59Z",
      "description": "Zero interest on BTC positions"
    }
  ],
  "all_eligible_currencies": ["ALL_BTC"],
  "all_eligible_protocols": ["nolus1leaser..."],
  "has_universal_campaign": false
}
```

### GET /api/campaigns/eligibility

Check if a wallet/protocol/currency combination is eligible for zero-interest.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Wallet address to check |
| `protocol` | string | No | Protocol/leaser address |
| `currency` | string | No | Currency ticker |

**Response:**
```json
{
  "eligible": true,
  "matching_campaigns": [
    {
      "id": 1,
      "name": "BTC Winter Campaign"
    }
  ],
  "reason": null
}
```

---

## Gated Admin API

Admin endpoints for managing the gated propagation system. All endpoints require authentication via `Authorization: Bearer <ADMIN_API_KEY>` header.

For detailed documentation, see [backend_api_enrichments_and_proxy.md](./backend_api_enrichments_and_proxy.md).

### Discovery Endpoints

#### GET /api/admin/gated/currencies

Returns all ETL currencies with their enrichment status.

#### GET /api/admin/gated/protocols

Returns all ETL protocols with their readiness status.

#### GET /api/admin/gated/networks

Returns all ETL networks with their configuration status.

#### GET /api/admin/gated/unconfigured

Returns all items that need configuration.

**Response:**
```json
{
  "currencies": [
    {
      "ticker": "NEW_TOKEN",
      "networks": ["neutron-1"],
      "protocols": ["NEUTRON-ASTROPORT-USDC_NOBLE"]
    }
  ],
  "networks": [],
  "protocols": []
}
```

### Currency Display CRUD

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/gated/currency-display` | GET | List all |
| `/api/admin/gated/currency-display` | PUT | Replace all |
| `/api/admin/gated/currency-display/{ticker}` | PUT | Upsert one |
| `/api/admin/gated/currency-display/{ticker}` | DELETE | Delete (hides currency) |

### Network Config CRUD

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/gated/network-config` | GET | List all |
| `/api/admin/gated/network-config` | PUT | Replace all |
| `/api/admin/gated/network-config/{network}` | PUT | Upsert one |
| `/api/admin/gated/network-config/{network}` | DELETE | Delete network |

### Lease Rules CRUD

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/gated/lease-rules` | GET | Get full config |
| `/api/admin/gated/lease-rules` | PUT | Replace full config |
| `/api/admin/gated/lease-rules/downpayment/{protocol}` | PUT | Upsert ranges |

### Swap & UI Settings

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/gated/swap-settings` | GET/PUT | Full swap config |
| `/api/admin/gated/ui-settings` | GET/PUT | Full UI config |
| `/api/admin/gated/ui-settings/hidden-proposals/{id}` | POST | Add hidden proposal |
| `/api/admin/gated/ui-settings/hidden-proposals/{id}` | DELETE | Remove hidden proposal |

---

## Translation Admin API

Admin endpoints for managing translations. All endpoints require authentication via `Authorization: Bearer <ADMIN_API_KEY>` header.

For detailed documentation, see [TRANSLATIONS.md](./TRANSLATIONS.md).

### GET /api/admin/translations/languages

Returns all configured languages with statistics.

**Response:**
```json
[
  {
    "key": "en",
    "label": "English",
    "is_source": true,
    "is_active": true,
    "key_count": 150,
    "missing_count": 0,
    "pending_count": 0,
    "is_complete": true
  },
  {
    "key": "ru",
    "label": "Русский",
    "is_source": false,
    "is_active": true,
    "key_count": 145,
    "missing_count": 5,
    "pending_count": 3,
    "is_complete": false
  }
]
```

### POST /api/admin/translations/sync

Detects missing translations across all languages.

**Response:**
```json
{
  "synced_at": "2026-01-31T12:00:00Z",
  "source_key_count": 150,
  "languages": [
    {
      "lang": "ru",
      "total_keys": 145,
      "missing_keys": 5,
      "pending_keys": 3
    }
  ]
}
```

### POST /api/admin/translations/generate

Generates AI translations for missing keys using OpenAI.

**Request Body:**
```json
{
  "lang": "ru",
  "keys": []  // Optional: specific keys to translate, empty = all missing
}
```

**Response:**
```json
{
  "batch_id": "a6ef2878-a26c-4297-ba49-33dbf56ac689",
  "lang": "ru",
  "total_keys": 11,
  "status": "completed"
}
```

### GET /api/admin/translations/pending

Returns pending translations awaiting approval.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Filter by language |
| `status` | string | Filter by status (pending, approved, rejected, edited) |
| `batch_id` | string | Filter by batch ID |

**Response:**
```json
[
  {
    "id": "14dd1571-e4a1-47f3-b66d-42663bffe638",
    "created_at": "2026-01-31T11:42:35Z",
    "source_key": "common.disconnect",
    "source_value": "Disconnect",
    "target_lang": "ru",
    "proposed_value": "Отключить",
    "placeholders": [],
    "placeholders_valid": true,
    "status": "pending",
    "source": "ai_generated",
    "ai_model": "gpt-5.2",
    "batch_id": "a6ef2878-a26c-4297-ba49-33dbf56ac689"
  }
]
```

### POST /api/admin/translations/pending/:id/approve

Approves a pending translation and applies it to the active locale.

### POST /api/admin/translations/pending/:id/reject

Rejects a pending translation.

**Request Body:**
```json
{
  "reason": "Translation doesn't match context"
}
```

### POST /api/admin/translations/pending/:id/edit

Edits and approves a pending translation.

**Request Body:**
```json
{
  "value": "Corrected translation"
}
```

### POST /api/admin/translations/pending/approve-batch

Bulk approves multiple pending translations.

**Request Body:**
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

**Response:**
```json
{
  "approved_count": 3
}
```

### GET /api/admin/translations/audit

Returns audit log of all translation changes.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Filter by language |
| `action` | string | Filter by action type |
| `limit` | number | Max entries (default 100) |

### POST /api/admin/translations/languages

Adds a new language.

**Request Body:**
```json
{
  "key": "de",
  "label": "Deutsch",
  "copy_from": "en",
  "auto_generate": true
}
```
