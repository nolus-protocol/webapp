# Gated Propagation System

## Overview

The gated propagation system filters ETL/on-chain data so that **unconfigured items are hidden by default**. Admin provides enrichment data (icons, colors, endpoints) and only configured items are visible to the frontend.

## Core Principle

Admin **never re-enters** data that ETL already provides. The system shows ETL data as read-only context, and only enrichment fields are editable.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                       │
├─────────────────────────────┬───────────────────────────────────────────────┤
│   ETL API (read-only)       │   Admin Config (JSON files)                   │
│   - Protocols               │   - currency-display.json                     │
│   - Currencies              │   - network-config.json                       │
│   - Networks                │   - lease-rules.json                          │
│   - Pools                   │   - swap-settings.json                        │
│   - Active status           │   - ui-settings.json                          │
└─────────────────────────────┴───────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROPAGATION MODULE                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  Validator  │  │   Filter    │  │   Merger    │                          │
│  │ (validate   │  │ (hide un-   │  │ (ETL +      │                          │
│  │  configs)   │  │  configured)│  │  enrichment)│                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GATED API ENDPOINTS                                  │
│  /api/assets          - Deduplicated assets with prices                     │
│  /api/protocols/gated - Configured protocols only                           │
│  /api/networks/gated  - Configured networks only                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entity States

| State | Condition | Frontend Visibility |
|-------|-----------|---------------------|
| **Active** | Configured + ETL `is_active: true` | Visible |
| **Blacklisted** | In blacklist config | Hidden |
| **Unconfigured** | ETL has it, no enrichment | Hidden (gated) |

## Config Files

All gated configuration files are stored in `backend/config/gated/`:

| File | Purpose |
|------|---------|
| `currency-display.json` | Currency enrichment (icon, color, displayName, shortName) |
| `network-config.json` | Network settings (endpoints, gas, explorer, primaryProtocol) |
| `lease-rules.json` | Downpayment ranges, asset restrictions |
| `swap-settings.json` | Skip API settings, swap currency tickers |
| `ui-settings.json` | Hidden proposals, feature flags |

### currency-display.json

```json
{
  "ATOM": {
    "icon": "/assets/icons/currencies/ATOM.svg",
    "displayName": "Cosmos Hub",
    "shortName": "ATOM",
    "color": "#2E3148",
    "coingeckoId": "cosmos"
  },
  "OSMO": {
    "icon": "/assets/icons/currencies/OSMO.svg",
    "displayName": "Osmosis",
    "shortName": "OSMO",
    "color": "#5E12A0"
  }
}
```

### network-config.json

```json
{
  "NEUTRON": {
    "name": "Neutron",
    "chain_id": "neutron-1",
    "prefix": "neutron",
    "rpc": "https://rpc-neutron.nolus.network",
    "lcd": "https://lcd-neutron.nolus.network",
    "fallback_rpc": ["https://neutron-rpc.polkachu.com"],
    "fallback_lcd": ["https://neutron-api.polkachu.com"],
    "gas_price": "0.025untrn",
    "explorer": "https://www.mintscan.io/neutron",
    "icon": "/icons/networks/neutron.svg",
    "primaryProtocol": "NEUTRON-ASTROPORT-USDC_NOBLE",
    "estimation": 20,
    "swap_venue": { "name": "neutron-astroport", "address": "neutron1war9ee549tt9rla54g56ca78y969l6239pang9" },
    "pools": {
      "NEUTRON-ASTROPORT-USDC_NOBLE": {
        "icon": "/assets/icons/pools/neutron-usdc.svg"
      }
    }
  }
}
```

### lease-rules.json

```json
{
  "downpayment_ranges": {
    "NEUTRON-ASTROPORT-USDC_NOBLE": {
      "default": { "min": 15, "max": 70 },
      "ALL_BTC": { "min": 35, "max": 70 },
      "ALL_ETH": { "min": 35, "max": 70 }
    }
  },
  "asset_restrictions": {
    "NEUTRON-ASTROPORT-USDC_NOBLE": {
      "ignore_all": [],
      "ignore_long": [],
      "ignore_short": []
    }
  }
}
```

## Validation Rules

### Currency is "Configured" when:
- Has entry in `currency-display.json` with:
  - `icon` (required)
  - `displayName` (required)

### Network is "Configured" when:
- Has entry in `network-config.json` with:
  - `rpc` endpoint (required)
  - `lcd` endpoint (required)
  - `gas_price` (required)
  - `swap_venue` (optional — enables swap routing through this network's DEX)

### Protocol is "Ready" when:
- Its network is configured
- All its currencies have display config
- LPN currency is configured

## API Endpoints

### Public Gated Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/assets` | Deduplicated assets with Oracle prices |
| `GET /api/assets/{ticker}` | Single asset details |
| `GET /api/networks/gated` | All configured networks |
| `GET /api/networks/{network}/info` | Single network details |
| `GET /api/networks/{network}/assets` | Assets available on network |
| `GET /api/networks/{network}/protocols` | Protocols on network |
| `GET /api/networks/{network}/pools` | LPP pools on network |
| `GET /api/protocols/gated` | All configured protocols |
| `GET /api/protocols/{protocol}/currencies` | Protocol currencies with prices |

### Admin Discovery Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/gated/currencies` | ETL currencies + enrichment status |
| `GET /api/admin/gated/protocols` | ETL protocols + readiness status |
| `GET /api/admin/gated/networks` | ETL networks + config status |
| `GET /api/admin/gated/unconfigured` | All items needing configuration |

### Admin CRUD Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/gated/currency-display` | GET | List all currency display configs |
| `/api/admin/gated/currency-display` | PUT | Replace all |
| `/api/admin/gated/currency-display/{ticker}` | PUT | Upsert one |
| `/api/admin/gated/currency-display/{ticker}` | DELETE | Delete (hides currency) |
| `/api/admin/gated/network-config` | GET | List all network configs |
| `/api/admin/gated/network-config` | PUT | Replace all |
| `/api/admin/gated/network-config/{network}` | PUT | Upsert network |
| `/api/admin/gated/network-config/{network}` | DELETE | Delete network |
| `/api/admin/gated/lease-rules` | GET/PUT | Full lease rules config |
| `/api/admin/gated/lease-rules/downpayment/{protocol}` | PUT | Upsert ranges |
| `/api/admin/gated/swap-settings` | GET/PUT | Full swap settings |
| `/api/admin/gated/ui-settings` | GET/PUT | Full UI settings |
| `/api/admin/gated/ui-settings/hidden-proposals/{id}` | POST/DELETE | Add/remove |

## Response Examples

### GET /api/assets

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

### GET /api/networks/gated

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

### GET /api/protocols/gated

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

### Admin Discovery: GET /api/admin/gated/unconfigured

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

## Implementation Files

### Backend Structure

```
backend/
├── config/gated/
│   ├── currency-display.json
│   ├── network-config.json
│   ├── lease-rules.json
│   ├── swap-settings.json
│   └── ui-settings.json
├── src/
│   ├── config_store/
│   │   ├── gated_types.rs      # Type definitions
│   │   └── storage.rs          # Load/save methods
│   ├── propagation/
│   │   ├── mod.rs              # Module exports
│   │   ├── validator.rs        # Config validation
│   │   ├── filter.rs           # Filter unconfigured items
│   │   └── merger.rs           # Merge ETL + enrichment
│   └── handlers/
│       ├── gated_admin.rs      # Admin CRUD endpoints
│       ├── gated_assets.rs     # Asset endpoints
│       ├── gated_protocols.rs  # Protocol endpoints
│       └── gated_networks.rs   # Network endpoints
```

## Prices

Prices are fetched from **Oracle contracts on-chain**, not from ETL. ETL only provides historical price data for charts.

- `GET /api/assets` - Returns assets with prices from the network's `primaryProtocol` Oracle
- `GET /api/protocols/{protocol}/currencies` - Returns protocol-specific Oracle prices

## Design Principles

1. **No Fallbacks** - If config file missing or invalid, fail immediately
2. **No Dead Code** - Unused code is deleted, not commented
3. **No Backwards Compatibility** - New API replaces old, no aliasing
4. **Fail Fast** - Validation errors return immediately, no silent defaults
5. **Hidden by Default** - Unconfigured items never reach frontend
6. **Admin never re-enters ETL data** - Only enrichment fields editable
7. **configStore as Source of Truth** - Frontend uses `configStore` methods, not hardcoded config

## Frontend Integration

The frontend `configStore` (`src/common/stores/config/index.ts`) is the single source of truth for protocol configuration. It fetches gated data from the backend and provides helper methods.

**Key Methods:**

| Method | Returns | Usage |
|--------|---------|-------|
| `getPositionType(protocol)` | `"Long"` or `"Short"` | Determine position type for display/logic |
| `getActiveProtocolsForNetwork(network)` | `string[]` | Get protocols available for a network filter |
| `getGatedProtocol(protocol)` | `GatedProtocol \| undefined` | Check if protocol is active/configured |
| `isProtocolFilterDisabled(network)` | `boolean` | Check if network has no active protocols |
| `getLpnByProtocol(protocol)` | `Currency \| undefined` | Get the LPN (stable) currency for a protocol |

**Removed Patterns (do not use):**
- `ProtocolsConfig[protocol].*` - use `configStore` methods instead
- `Contracts.protocolsFilter` - use `configStore.getActiveProtocolsForNetwork()` instead
- `PositionTypes.long/short` - use `configStore.getPositionType(protocol)` instead

## Transaction Enrichment (BFF)

Beyond the gated propagation system, the backend also enriches transaction history data. The `/api/etl/txs` endpoint is a custom handler (not a raw proxy) that:

1. Fetches raw transactions from ETL
2. Filters system transactions using a `SUPPORTED_TX_TYPES` allowlist
3. Decodes base64 protobuf `value` fields into structured `data` JSON objects
4. Returns enriched transactions with camelCase fields matching frontend expectations

### Implementation

**Source:** `backend/src/handlers/transactions.rs`

Decoded transactions are cached in an LRU cache (500 entries, 300s TTL via `mini-moka`) keyed by `(address, skip, limit)`. Since transaction data is immutable once confirmed, the cache avoids redundant protobuf decoding on repeated requests.

The handler uses `cosmrs::proto` + `prost` to decode 9 cosmos message types:

| Type URL | Decoded Fields |
|----------|---------------|
| `MsgSend` | `fromAddress`, `toAddress`, `amount[]` |
| `MsgTransfer` | `sender`, `receiver`, `token`, `sourcePort`, `sourceChannel` |
| `MsgExecuteContract` | `sender`, `contract`, `msg` (UTF-8 JSON string), `funds[]` |
| `MsgVote` | `voter`, `proposalId`, `option` |
| `MsgDelegate` | `delegatorAddress`, `validatorAddress`, `amount` |
| `MsgUndelegate` | `delegatorAddress`, `validatorAddress`, `amount` |
| `MsgWithdrawDelegatorReward` | `delegatorAddress`, `validatorAddress` |
| `MsgBeginRedelegate` | `delegatorAddress`, `validatorSrcAddress`, `validatorDstAddress`, `amount` |
| `MsgRecvPacket` | `packet: { data (UTF-8 JSON), sourcePort, sourceChannel, ... }` |

### Swap Detection (is_swap)

For IBC messages (`MsgTransfer`, `MsgRecvPacket`), the handler determines whether a transaction is a swap (via Skip/DEX) or a direct transfer between wallets:

1. Extract the user's address and the counterparty address from the transaction
2. Decode both addresses using bech32 to extract the raw data bytes
3. Compare the data parts (bytes between the `1` separator and the 6-byte checksum)
4. If the data parts **differ** → `is_swap: true` (different keys = routed through a DEX)
5. If the data parts **match** → `is_swap: false` (same key on different chains = direct IBC transfer)

The `is_swap` boolean field is added to the enriched transaction JSON alongside the existing fields.

### Encoding Notes

- `MsgExecuteContract.msg`: Sent as a UTF-8 JSON string (not base64). The protobuf `msg` field contains JSON bytes (e.g., `{"deposit":[]}`) which are converted to a string via `String::from_utf8`.
- `MsgRecvPacket.packet.data`: Same treatment — UTF-8 JSON string, not base64.
- Unknown message types: Transaction included without `data` field (graceful degradation).

### Filtering

System transactions are filtered server-side via the `SUPPORTED_TX_TYPES` allowlist. This replaces the previous frontend-side filtering that excluded `MsgUpdateClient` and `MsgAcknowledgement`.

## Testing

```bash
# Build
cd backend && cargo build --release

# Run tests
cargo test

# Start server
STATIC_DIR=../dist ./target/release/nolus-backend

# Test endpoints
curl http://localhost:3000/api/networks/gated
curl http://localhost:3000/api/protocols/gated
curl http://localhost:3000/api/assets
curl "http://localhost:3000/api/etl/txs?address=nolus1abc...&skip=0&limit=3"
curl -H "Authorization: Bearer $ADMIN_KEY" http://localhost:3000/api/admin/gated/unconfigured
```
