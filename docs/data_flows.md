# Data Flows Documentation

This document describes how data flows through the Nolus Webapp, from external sources through the backend to the end user. Each flow shows the data transformations at each layer with real examples.

> **Implementation Status:** All data flows described here are fully implemented. The Rust backend handles all external API communication, caching, and data transformation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Gated Propagation Data Flow](#2-gated-propagation-data-flow) *(NEW)*
3. [Price Data Flow](#3-price-data-flow)
4. [Configuration Data Flow](#4-configuration-data-flow)
5. [Balance Data Flow](#5-balance-data-flow)
6. [Lease Data Flow](#6-lease-data-flow)
7. [Earn Data Flow](#7-earn-data-flow)
8. [Staking Data Flow](#8-staking-data-flow)
9. [Swap Data Flow](#9-swap-data-flow)
10. [Governance Data Flow](#10-governance-data-flow)
11. [WebSocket Real-Time Updates](#11-websocket-real-time-updates)
12. [Referral Program Data Flow](#12-referral-program-data-flow)
13. [Zero-Interest Campaigns Data Flow](#13-zero-interest-campaigns-data-flow)
14. [Translation Management Data Flow](#14-translation-management-data-flow)
15. [Transaction History Data Flow](#15-transaction-history-data-flow)
16. [Stats Data Flow (useStatsStore)](#16-stats-data-flow-usestatsstore)
17. [Analytics Data Flow (useAnalyticsStore)](#17-analytics-data-flow-useanalyticsstore)
18. [Configuration Reference](#configuration-reference)

---

## Architecture Overview

The Nolus Webapp follows a **Backend-for-Frontend (BFF)** pattern where all data flows through a Rust backend before reaching the Vue frontend.

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Nolus Chain │  ETL API    │  Skip API   │Referral API │ Zero Interest API   │
│  (RPC/LCD)  │ (Analytics) │  (Swaps)    │             │ (Payments Manager)  │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┤
│                            + OpenAI API (Translations)                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ Bearer Token Auth (where required)
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RUST BACKEND (Axum)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Handlers   │  │ Cached<T>   │  │   Config    │  │  WebSocket  │        │
│  │ (Transform) │  │ (arc-swap)  │  │   Store     │  │   Manager   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
           ┌───────────────┐                   ┌───────────────┐
           │   REST API    │                   │   WebSocket   │
           │   /api/*      │                   │     /ws       │
           └───────┬───────┘                   └───────┬───────┘
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VUE FRONTEND                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ BackendApi  │  │   Pinia     │  │    Vue      │  │  WebSocket  │        │
│  │  (Client)   │→ │   Stores    │→ │ Components  │  │   Client    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │   Browser   │
                              │    (User)   │
                              └─────────────┘
```

### Key Transformation Points

| Layer | Location | Purpose |
|-------|----------|---------|
| **External → Backend** | `backend/src/external/*.rs` | Fetch raw data from external APIs |
| **Backend Handlers** | `backend/src/handlers/*.rs` | Transform, merge, enrich data (16 handlers) |
| **Backend Cache** | `backend/src/data_cache.rs` | Lock-free Cached<T> values refreshed by background tasks (event-driven + timer-based) |
| **Backend → Frontend** | REST API responses | Serialize to JSON |
| **Frontend API Client** | `src/common/api/BackendApi.ts` | Transform response to store-friendly format |
| **Frontend Stores** | `src/common/stores/*/index.ts` | State management, computed values |
| **Stores → Components** | Vue computed properties | Display formatting |

---

## 1b. Wallet Connection & Switch Flow

When a user connects or switches wallets, all user-specific stores must be re-initialized with the new address. This flow is centralized through `connectionStore.connectWallet()`.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WALLET CONNECTION LAYERS                                 │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │  view.vue      │  │ entry-client.ts│  │  connectionStore               │ │
│  │                │  │                │  │                                │ │
│  │ Event listeners│  │ Wallet watcher │  │ connectWallet(address)         │ │
│  │ keplr/leap     │──│ (initial load) │──│   → balancesStore.setAddress() │ │
│  │ keystorechange │  │                │  │   → leasesStore.setOwner()     │ │
│  │                │  │                │  │   → stakingStore.setAddress()  │ │
│  │ updateKeplr()  │  │                │  │   → earnStore.setAddress()     │ │
│  │ updateLeap()   │  │                │  │   → analyticsStore.setAddress()│ │
│  │                │  │                │  │   → historyStore.setAddress()  │ │
│  └────────────────┘  └────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Two Entry Points

| Source | When | Handler |
|--------|------|---------|
| `view.vue` event listeners | User switches wallet in browser extension (Keplr/Leap) | `updateKeplr()` / `updateLeap()` → `wallet.CONNECT_KEPLR()` → `connectionStore.connectWallet()` |
| `entry-client.ts` watcher | Initial page load auto-reconnect (walletOperation restores session) | Watches `walletStore.wallet?.address` → `connectionStore.connectWallet()` |

### Deduplication

The `entry-client.ts` watcher skips if `connectionStore.walletAddress === newAddress`, preventing double calls when `view.vue` has already handled a wallet switch via event listeners.

### Key Implementation Details

- **Event listener registration**: The `configStore.initialized` watcher in `view.vue` uses `{ immediate: true }` — critical because with optimistic localStorage caching, `initialized` may already be `true` when the component mounts. Without `immediate`, the watcher callback never fires and event listeners are never registered.
- **No component-level wallet watchers**: Individual page components (`Leases.vue`, `DashboardLeases.vue`, etc.) do NOT watch wallet changes. All store coordination happens exclusively through `connectionStore.connectWallet()`. Components like `DashboardRewards.vue`, `UndelegateForm.vue`, and `stake/view.vue` rely on `connectionStore` — they do NOT have their own wallet watchers to call `stakingStore.setAddress()` or `stakingStore.fetchPositions()`.
- **No direct store calls in connect actions**: Wallet connect actions (`connectKeplr.ts`, `connectLeap.ts`, `connectLedger.ts`, `connectPhantom.ts`, `connectSolFlare.ts`) only set `wallet` state on the wallet store. They do NOT call `balancesStore.setAddress()` or `historyStore.setAddress()` directly — that's `connectionStore`'s responsibility.
- **Disconnect flow**: `Disconnect.vue` calls both `wallet[WalletActions.DISCONNECT]()` (clears wallet state) and `connectionStore.disconnectWallet()` (clears all user-specific stores: balances, leases, staking, earn, analytics, history).
- **Price polling ownership**: Price polling is handled exclusively by `pricesStore.startPolling()` (called during `pricesStore.initialize()`). `view.vue` does NOT have its own price polling interval — it only manages balance polling. This avoids duplicate price fetches.
- **Balance polling**: `view.vue` manages a balance polling interval via `startBalancePolling()`, called when `configStore.initialized` becomes true.

### Key Files

| File | Role |
|------|------|
| `src/modules/view.vue` | Registers `keplr_keystorechange` / `leap_keystorechange` event listeners, manages balance polling |
| `src/entry-client.ts` | Watches `walletStore.wallet?.address` for initial page load reconnect |
| `src/common/stores/connection/index.ts` | `connectWallet()` / `disconnectWallet()` — coordinates all user-specific stores |
| `src/common/stores/wallet/actions/connect*.ts` | Set wallet state only (no direct store calls) |
| `src/common/components/auth/Disconnect.vue` | Calls `connectionStore.disconnectWallet()` on user disconnect |

---

## 2. Gated Propagation Data Flow

The gated propagation system ensures that only configured items are visible to users. It merges ETL data with admin-provided enrichment (icons, colors, display names).

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                       │
├─────────────────────────────┬───────────────────────────────────────────────┤
│   ETL API                   │   Config Files (backend/config/gated/)        │
│   - protocols[]             │   - currency-display.json                     │
│   - currencies[]            │   - network-config.json                       │
│   - networks[]              │   - lease-rules.json                          │
└─────────────────────────────┴───────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROPAGATION MODULE                                     │
│                                                                              │
│   1. PropagationValidator  - Validate configs exist for ETL items           │
│   2. PropagationFilter     - Filter out unconfigured items                  │
│   3. PropagationMerger     - Merge ETL data + enrichment configs            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GATED API ENDPOINTS                                  │
│                                                                              │
│   GET /api/assets              → Deduplicated assets with Oracle prices     │
│   GET /api/networks/gated      → Configured networks only                   │
│   GET /api/protocols/gated     → Configured protocols only                  │
│   GET /api/networks/{n}/assets → Assets on specific network                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Fetch ETL Data

**Source:** `backend/src/external/etl.rs`

```rust
// Fetch all protocols from ETL
let etl_protocols = state.etl_client.fetch_protocols().await?;
// Returns: [{ protocol: "NEUTRON-ASTROPORT-USDC_NOBLE", network: "Neutron", ... }]
```

### Step 2: Load Admin Config

**Source:** `backend/src/config_store/storage.rs`

```rust
// Load currency display enrichment
let currency_display = state.config_store.load_currency_display().await?;
// Returns: { "ATOM": { icon: "...", displayName: "Cosmos Hub", color: "#2E3148" } }

// Load network configuration
let network_config = state.config_store.load_gated_network_config().await?;
// Returns: { networks: { "NEUTRON": { rpc: "...", lcd: "...", ... } } }
```

### Step 3: Filter Unconfigured Items

**Source:** `backend/src/propagation/filter.rs`

```rust
// Only return protocols where:
// 1. Network is configured (has RPC, LCD, gas_price)
// 2. All currencies have display config (icon, displayName)
let filtered = PropagationFilter::filter_protocols(
    &etl_protocols,
    &network_config,
    &currency_display
)?;
```

**Filtering Rules:**
- Currency needs: `icon` + `displayName` in currency-display.json
- Network needs: `rpc` + `lcd` + `gas_price` in network-config.json
- Protocol needs: network configured + all currencies configured

### Step 4: Merge Enrichment Data

**Source:** `backend/src/propagation/merger.rs`

```rust
// Add display info to each currency
let merged = PropagationMerger::merge_protocols(
    &filtered_protocols,
    &currency_display,
    &network_config
)?;
```

**Merged Response:**
```json
{
  "protocol": "NEUTRON-ASTROPORT-USDC_NOBLE",
  "network": "Neutron",
  "lpn": "USDC_NOBLE",
  "lpn_display": {
    "icon": "/assets/icons/currencies/USDC_NOBLE.svg",
    "displayName": "Noble USDC",
    "shortName": "USDC",
    "color": "#2775CA"
  }
}
```

### Step 5: Add Oracle Prices

**Source:** `backend/src/handlers/gated_assets.rs`

Prices come from on-chain Oracle contracts, NOT from ETL:

```rust
// Fetch prices from Oracle contract
let prices = get_prices(state).await?;

// Add price to each asset
for asset in &mut assets {
    if let Some(price) = prices.get(&asset.ticker) {
        asset.price_usd = Some(price.price_usd.clone());
    }
}
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/propagation/mod.rs` | Module exports |
| `backend/src/propagation/validator.rs` | Validate configs against ETL |
| `backend/src/propagation/filter.rs` | Filter unconfigured items |
| `backend/src/propagation/merger.rs` | Merge ETL + enrichment |
| `backend/src/handlers/gated_assets.rs` | Asset endpoints |
| `backend/src/handlers/gated_protocols.rs` | Protocol endpoints |
| `backend/src/handlers/gated_networks.rs` | Network endpoints |
| `backend/src/handlers/gated_admin.rs` | Admin CRUD endpoints |

### Config Files

| File | Content |
|------|---------|
| `backend/config/gated/currency-display.json` | Icon, displayName, color per ticker |
| `backend/config/gated/network-config.json` | RPC, LCD, gas, explorer per network |
| `backend/config/gated/lease-rules.json` | Downpayment ranges, asset restrictions |
| `backend/config/gated/swap-settings.json` | Skip API settings, swap currency tickers |
| `backend/config/gated/ui-settings.json` | Hidden proposals, feature flags |

### User Data Filtering

Beyond public API responses, gated filtering also applies to user-specific data (leases, earn positions, balances, prices). This ensures users only see data for configured protocols and currencies.

**Source:** `backend/src/propagation/user_data_filter.rs`

#### Filter Context

The `UserDataFilterContext` is built from gated config + ETL data:

```rust
pub struct UserDataFilterContext {
    // Protocols with network + LPN configured
    pub configured_protocols: HashMap<String, ProtocolFilterInfo>,
    // Currencies with icon + displayName
    pub configured_currencies: HashSet<String>,
    // Asset restriction sets from lease-rules.json
    pub ignore_all: HashSet<String>,    // Hidden from all views
    pub ignore_long: HashSet<String>,   // Hidden from long positions
    pub ignore_short: HashSet<String>,  // Hidden from short positions
}
```

#### Filtering Rules

| Data Type | Filter Method | Rule |
|-----------|---------------|------|
| **Leases** | `is_lease_visible()` | Protocol configured + asset not restricted for position type |
| **Earn Positions** | `is_earn_position_visible()` | Protocol configured |
| **Balances** | `is_balance_visible()` | Currency configured + not in `ignore_all` |
| **Prices (WebSocket)** | `is_price_visible()` | Currency configured |

#### Asset Restrictions (lease-rules.json)

```json
{
  "asset_restrictions": {
    "ignore_all": ["RESTRICTED_TOKEN"],
    "ignore_long": ["STABLE_COIN"],
    "ignore_short": ["VOLATILE_TOKEN"]
  }
}
```

- `ignore_all`: Asset hidden from all views (balances, leases, earn)
- `ignore_long`: Asset hidden only from long position leases
- `ignore_short`: Asset hidden only from short position leases

Position type comes from `EtlProtocol.position_type` (per-protocol), not individual leases.

#### REST Handlers Using Filter

| Handler | Endpoint | Filter Method |
|---------|----------|---------------|
| `leases.rs` | `GET /api/leases` | `is_lease_visible()` |
| `earn.rs` | `GET /api/earn/positions` | `is_earn_position_visible()` |
| `earn.rs` | `GET /api/earn/pools` | `is_earn_position_visible()` |
| `currencies.rs` | `GET /api/balances` | `is_balance_visible()` |

#### WebSocket Handlers Using Filter

| Subscription | Filter Method |
|--------------|---------------|
| `prices` | `is_price_visible()` |
| `leases` | `is_lease_visible()` |
| `earn` | `is_earn_position_visible()` |

#### Example: Lease Filtering

```rust
// In get_leases() handler
let filter_ctx = build_filter_context(&state.config_store, &state.etl_client).await?;

// Filter protocols first
let visible_protocols: Vec<_> = protocols
    .into_iter()
    .filter(|p| filter_ctx.is_protocol_visible(&p.protocol))
    .collect();

// Then filter individual leases by asset restrictions
for lease in leases {
    if filter_ctx.is_lease_visible(&lease.protocol, &lease.asset_ticker) {
        filtered_leases.push(lease);
    }
}
```

#### Example: Balance Filtering

```rust
// In get_balances() handler
for balance in bank_balances {
    // Skip unconfigured currencies or restricted assets
    if !filter_ctx.is_balance_visible(&currency.ticker) {
        continue;
    }
    // Process visible balance...
}
```

---

### Frontend configStore Usage

The frontend `configStore` (`src/common/stores/config/index.ts`) is the **single source of truth** for protocol configuration. It fetches gated data from the backend and provides helper methods for components.

**Key Methods:**

| Method | Returns | Usage |
|--------|---------|-------|
| `getPositionType(protocol)` | `"Long"` or `"Short"` | Determine position type for display/logic |
| `getActiveProtocolsForNetwork(network)` | `string[]` | Get protocols available for a network filter |
| `getGatedProtocol(protocol)` | `GatedProtocol \| undefined` | Check if protocol is active/configured |
| `isProtocolFilterDisabled(network)` | `boolean` | Check if network has no active protocols |
| `getLpnByProtocol(protocol)` | `Currency \| undefined` | Get the LPN (stable) currency for a protocol |

**Example Usage in Components:**

```typescript
// In SupplyForm.vue, WithdrawForm.vue
const activeProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);

// In DashboardAssets.vue, AssetsTable.vue
const gatedProtocol = configStore.getGatedProtocol(protocol);
if (!gatedProtocol) return false;

// In PnlLog.vue, LeaseCalculator.ts
const positionType = configStore.getPositionType(protocol);
if (positionType === "Short") {
  currency = getLpnByProtocol(protocol);
}

// In DashboardLeases.vue
const isProtocolDisabled = configStore.isProtocolFilterDisabled(configStore.protocolFilter);
```

**Important:** The frontend no longer uses hardcoded `ProtocolsConfig`, `PositionTypes`, or `Contracts.protocolsFilter` from `src/config/global/contracts.ts`. These were removed in favor of dynamic `configStore` methods that fetch data from the backend's gated propagation system.

### Centralized Currency Resolution

Currency resolution — mapping a ticker to a fully-enriched asset with price, balance, earn status, and APR — is centralized in two layers:

**Layer 1: CurrencyLookup utility functions** (`src/common/utils/CurrencyLookup.ts`)

Thin wrappers around `configStore` methods. Used by non-component code (utilities, plain functions):

| Function | Context | Usage |
|----------|---------|-------|
| `getCurrencyByTickerForProtocol(ticker, protocol)` | Protocol known | Leases, earn, history, PnL |
| `getCurrencyByTickerForNetwork(ticker)` | Network context | Receive form, stats charts |
| `getCurrencyByDenom(denom)` | IBC denom known | Balance display, fee calculation |
| `getCurrencyByTicker(ticker)` | Globally unique ticker | NLS staking only (safe because NLS is unique) |

**Layer 2: `useNetworkCurrency` composable** (`src/common/composables/useNetworkCurrency.ts`)

Used by Vue components that need fully-enriched asset data (price, balance, earn, APR):

```typescript
interface ResolvedAsset {
  currency: CurrencyInfo;
  price: string;
  priceAsNumber: number;
  balance: string;
  balanceUsd: number;
  isEarnable: boolean;
  apr: number;
  isNative: boolean;
  stakingApr: number;
}
```

Two entry points:
- `resolveForNetwork(ticker)` — resolves for current network filter. Used by assets page, dashboard.
- `resolveForProtocol(ticker, protocol)` — resolves for a specific protocol. Used by lease/earn contexts.
- `getNetworkAssets()` — builds the full enriched asset list for the current network. Replaces duplicated `filteredAssets` logic.

**Why this exists:** The same ticker (e.g., `USDC_NOBLE`) can exist on multiple networks (Osmosis, Neutron) with different IBC denoms and protocol keys. The old `getCurrencyByTicker()` returned the first match, ignoring which network the user has selected. This caused incorrect prices, balances, and APR display when tickers were shared across networks.

**Resolution rules:**
1. Protocol context (known protocol) → construct key as `ticker@protocol`, look up by key. Always exact.
2. Network context (current filter) → `getCurrencyByTickerForNetwork` prefers currencies whose protocol belongs to the selected network's active protocols.
3. Earn/APR → match LPN by key first, then by ticker within network protocols. Check `getGatedProtocol` to confirm protocol is active.

**Key files:**

| File | Role |
|------|------|
| `src/common/composables/useNetworkCurrency.ts` | Composable with `resolveForNetwork`, `resolveForProtocol`, `getNetworkAssets` |
| `src/common/utils/CurrencyLookup.ts` | Utility functions: `getCurrencyByTickerForProtocol`, `getCurrencyByTickerForNetwork` |
| `src/common/stores/config/index.ts` | `getCurrencyByTickerForNetwork()`, `getCurrencyByKey()` on configStore |

---

## 3. Price Data Flow

Prices flow from Oracle smart contracts on-chain through the backend to the frontend for display.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Oracle Smart   │     │  Rust Backend   │     │  Vue Frontend   │
│   Contracts     │     │                 │     │                 │
│  (8 protocols)  │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  CosmWasm Query       │                       │
         │  get_prices()         │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  Raw Oracle Response  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │                       │  Transform & Cache    │
         │                       │  (calculate USD)      │
         │                       │                       │
         │                       │  GET /api/prices      │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  PricesResponse       │
         │                       ├──────────────────────>│
         │                       │                       │
         │                       │                       │  Transform to
         │                       │                       │  PriceData
         │                       │                       │
         │                       │                       │  Store in Pinia
         │                       │                       │
         │                       │                       │  Display in UI
```

### Step 1: Oracle Contract Query

**Source:** `backend/src/external/chain.rs`

The backend queries each protocol's Oracle contract to get raw price data.

```rust
// Query: get_prices on Oracle contract
let query_msg = r#"{"prices":{}}"#;
let result = self.query_smart_contract(&oracle_address, query_msg).await?;
```

**Raw Response from Oracle Contract:**
```json
{
  "prices": [
    {
      "amount": { "ticker": "ATOM", "amount": "1000000" },
      "amount_quote": { "ticker": "USDC_NOBLE", "amount": "4520000" }
    },
    {
      "amount": { "ticker": "OSMO", "amount": "1000000" },
      "amount_quote": { "ticker": "USDC_NOBLE", "amount": "462000" }
    }
  ]
}
```

**Why this format:** Oracle contracts store prices as ratios between asset amounts and quote currency amounts. This allows precise on-chain calculations without floating-point errors.

### Step 2: Backend Transformation

**Source:** `backend/src/handlers/currencies.rs:fetch_prices_internal()`

The handler calculates USD prices from the oracle ratios:

```rust
// Calculate LPN (base currency) price in USD
let lpn_price = calculate_price(
    &stable_price.amount_quote.amount,  // e.g., "1000000" (USDC)
    &stable_price.amount.amount,         // e.g., "1000000" (LPN amount)
);

// Calculate asset price: (quote / amount) * lpn_price
let asset_price = calculate_price_with_lpn(
    &price.amount_quote.amount,  // "4520000"
    &price.amount.amount,        // "1000000"
    &lpn_price,                  // "1.0"
);
// Result: (4520000 / 1000000) * 1.0 = 4.52
```

**Backend Response (GET /api/prices):**
```json
{
  "prices": {
    "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "ATOM",
      "price_usd": "4.520000"
    },
    "OSMO@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "OSMO@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "OSMO",
      "price_usd": "0.462000"
    },
    "ALL_BTC@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "ALL_BTC@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "ALL_BTC",
      "price_usd": "837.8601398942407"
    }
  },
  "updated_at": "2026-01-31T05:47:20.040474Z"
}
```

**Why this format:** The key format `TICKER@PROTOCOL` uniquely identifies each asset-protocol combination since the same asset can have different prices on different DEXes.

### Step 3: Frontend API Client Transformation

**Source:** `src/common/api/BackendApi.ts:getPrices()`

The API client transforms the response to a simpler format for the store:

```typescript
async getPrices(): Promise<PriceData> {
  const response = await this.request<PricesResponse>("GET", "/api/prices");
  
  // Transform { prices: { key: { key, symbol, price_usd } } } 
  // to { key: { price, symbol } }
  const priceData: PriceData = {};
  for (const [key, info] of Object.entries(response.prices)) {
    priceData[key] = {
      price: info.price_usd,
      symbol: info.symbol,
    };
  }
  return priceData;
}
```

**Transformed Frontend Format:**
```typescript
{
  "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE": { price: "4.520000", symbol: "ATOM" },
  "OSMO@OSMOSIS-OSMOSIS-USDC_NOBLE": { price: "0.462000", symbol: "OSMO" },
  "ALL_BTC@OSMOSIS-OSMOSIS-USDC_NOBLE": { price: "837.86", symbol: "ALL_BTC" }
}
```

**Why this transformation:** Removes redundant `key` field and renames `price_usd` to `price` for simpler access in components.

### Step 4: Pinia Store

**Source:** `src/common/stores/prices/index.ts`

The store caches prices in localStorage and provides helper methods:

```typescript
// State
const prices = ref<PriceData>({});

// Helper methods
function getPriceAsNumber(key: string): number {
  const price = getPrice(key);
  return price ? parseFloat(price) : 0;
}

// Usage in components
const atomPrice = pricesStore.getPriceAsNumber("ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE");
// Returns: 4.52
```

### Step 5: Component Display

```vue
<template>
  <div class="price">
    ${{ formatPrice(pricesStore.getPriceAsNumber(assetKey)) }}
  </div>
</template>

<script setup>
const assetKey = "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE";
// Displays: $4.52
</script>
```

### Caching Strategy

| Layer | TTL | Rationale |
|-------|-----|-----------|
| Backend cache (Cached<T>) | ~6 seconds | Refreshed on every 2nd NewBlock via CometBFT WebSocket events |
| Frontend localStorage | 5 minutes | Optimistic loading, background refresh |
| Frontend Polling | 30 seconds | `pricesStore.startPolling()` — sole owner of price polling (no duplicate intervals in `view.vue`) |

### Config Impact on Prices

**Config file:** `backend/config/currencies.json`

```json
{
  "currencies": {
    "ATOM": { 
      "name": "Cosmos Hub", 
      "coinGeckoId": "cosmos",
      "symbol": "uatom" 
    }
  },
  "map": {
    "USDC@OSMOSIS-OSMOSIS-USDC_AXELAR": "USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR"
  }
}
```

The `map` field remaps certain currency keys for display consistency.

---

## 2. Configuration Data Flow

Configuration includes protocols, networks, contracts, and webapp settings.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Admin Contract │     │  Rust Backend   │     │  Vue Frontend   │
│  + Config Files │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  Query: protocols     │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  Read: config/*.json  │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │                       │  Merge & Enrich       │
         │                       │                       │
         │                       │  GET /api/config      │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  AppConfigResponse    │
         │                       ├──────────────────────>│
         │                       │                       │
         │                       │                       │  Store in Pinia
```

### Step 1: Admin Contract Query

**Source:** `backend/src/external/chain.rs`

```rust
// Query Admin contract for all protocols
let query_msg = r#"{"protocols":{}}"#;
let result = self.query_smart_contract(&admin_contract, query_msg).await?;
```

**Raw Response:**
```json
{
  "protocols": [
    "OSMOSIS-OSMOSIS-USDC_NOBLE",
    "OSMOSIS-OSMOSIS-USDC_AXELAR",
    "NEUTRON-ASTROPORT-USDC_NOBLE"
  ]
}
```

### Step 2: Protocol Details Query

For each protocol, the backend queries for contract addresses:

```rust
// Query: protocol details
let query_msg = format!(r#"{{"protocol":{{"protocol":"{}"}}}}"#, protocol_name);
```

**Raw Response:**
```json
{
  "network": "OSMOSIS",
  "contracts": {
    "oracle": "nolus1vjlaegqa7ssm2ygf2nnew6smsj8ref9cmurerc7pzwxqjre2wzpqyez4w6",
    "lpp": "nolus1ueytzwqyadm6r0z8ajse7g6gzum4w3vv04qazctf8ugqrrej6n4sq027cf",
    "leaser": "nolus1dca9sf0knq3qfg55mv2sn03rdw6gukkc4n764x5pvdgrgnpf9mzsfkcjp6",
    "profit": "nolus1r69jl4n2hp6vd4ex7xx5l9rcq8qcjeh8fefauzgvpnz2e0khqe9qnw25u4",
    "reserve": "nolus1rwt3r80pgdxgf98nzgmca79wusyghyh84m7ky2354009u40lxhpq5y94fm"
  }
}
```

### Step 3: Backend Response

**Source:** `backend/src/handlers/config.rs`

**GET /api/config Response:**
```json
{
  "protocols": {
    "OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "name": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "network": "OSMOSIS",
      "dex": "OSMOSIS",
      "lpn": "USDC_NOBLE",
      "contracts": {
        "oracle": "nolus1vjlaegqa7ssm2ygf2nnew6smsj8ref9cmurerc7pzwxqjre2wzpqyez4w6",
        "lpp": "nolus1ueytzwqyadm6r0z8ajse7g6gzum4w3vv04qazctf8ugqrrej6n4sq027cf",
        "leaser": "nolus1dca9sf0knq3qfg55mv2sn03rdw6gukkc4n764x5pvdgrgnpf9mzsfkcjp6",
        "profit": "nolus1r69jl4n2hp6vd4ex7xx5l9rcq8qcjeh8fefauzgvpnz2e0khqe9qnw25u4",
        "reserve": "nolus1rwt3r80pgdxgf98nzgmca79wusyghyh84m7ky2354009u40lxhpq5y94fm"
      },
      "active": true
    }
  },
  "networks": {
    "nolus": {
      "name": "Nolus",
      "chain_id": "pirin-1",
      "prefix": "nolus",
      "native_denom": "unls",
      "gas_price": "0.0025unls",
      "explorer": "https://explorer.nolus.io",
      "decimal_digits": 6
    }
  },
  "native_asset": {
    "ticker": "NLS",
    "symbol": "NLS",
    "denom": "unls",
    "decimal_digits": 6
  }
}
```

### Webapp Configuration

Webapp-specific settings are served from domain-specific endpoints:
- `/api/leases/config/{protocol}` — lease validation config (downpayment ranges + on-chain LeaserConfig)
- `/api/swap/config` — Skip API swap routing config
- `/api/governance/hidden-proposals` — hidden proposal IDs
- `/api/locales/{lang}` — translation files

**Currency display config** (icons, names, colors) is managed via the gated propagation system (`currency-display.json`) and served through `/api/protocols/{protocol}/currencies`.

**Previously at `/api/webapp/config/currencies`:**
```json
{
  "icons": "/assets/icons/currencies",
  "currencies": {
    "ATOM": {
      "name": "Cosmos Hub",
      "shortName": "ATOM",
      "coinGeckoId": "cosmos",
      "symbol": "uatom"
    },
    "ALL_BTC": {
      "name": "Alloyed BTC",
      "shortName": "BTC",
      "coinGeckoId": "osmosis-allbtc",
      "symbol": "factory/osmo1z6r6qdknhgsc0zeracktgpcxf43j6sekq07nw8sxduc9lg0qjjlqfu25e3/alloyed/allBTC"
    }
  },
  "map": {
    "USDC@OSMOSIS-OSMOSIS-USDC_AXELAR": "USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR"
  }
}
```

---

## 3. Balance Data Flow

User balances are fetched from the chain's bank module and enriched with currency metadata and USD values.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Bank Module    │     │  Rust Backend   │     │  Vue Frontend   │
│  (Nolus Chain)  │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  /bank/balances/{addr}│                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  Raw Bank Balances    │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │                       │  + Currencies         │
         │                       │  + Prices             │
         │                       │  = Enriched Balances  │
         │                       │                       │
         │                       │  GET /api/balances    │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  BalancesResponse     │
         │                       ├──────────────────────>│
```

### Step 1: Bank Module Query

**Source:** `backend/src/external/chain.rs`

```rust
let url = format!("{}/cosmos/bank/v1beta1/balances/{}", self.rest_url, address);
```

**Raw Response:**
```json
{
  "balances": [
    { "denom": "unls", "amount": "1500000000" },
    { "denom": "ibc/6CDD4663F2F09CD62285E2D45891FC149A3568E316CE3EBBE201A71A78A69388", "amount": "5000000" }
  ]
}
```

### Step 2: Backend Enrichment

**Source:** `backend/src/handlers/currencies.rs:get_balances()`

The backend performs three parallel operations then merges the results:

```rust
// Fetch in parallel
let (bank_balances_result, currencies_result, prices_result) = tokio::join!(
    state.chain_client.get_all_balances(&query.address),
    get_currencies(State(state.clone())),
    get_prices(State(state.clone()))
);

// For each balance, find currency info and calculate USD value
for bank_balance in bank_balances {
    if let Some(currency) = currencies.iter().find(|c| c.bank_symbol == bank_balance.denom) {
        let human_amount = amount_f64 / 10_f64.powi(currency.decimal_digits as i32);
        let amount_usd = human_amount * price_usd;
        // ...
    }
}
```

**GET /api/balances?address=nolus1... Response:**
```json
{
  "balances": [
    {
      "key": "NLS@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "NLS",
      "denom": "unls",
      "amount": "1500000000",
      "amount_usd": "5.72",
      "decimal_digits": 6
    },
    {
      "key": "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "ATOM",
      "denom": "ibc/6CDD4663F2F09CD62285E2D45891FC149A3568E316CE3EBBE201A71A78A69388",
      "amount": "5000000",
      "amount_usd": "22.60",
      "decimal_digits": 6
    }
  ],
  "total_value_usd": "28.32"
}
```

**Key transformations:**
1. Raw `denom` → mapped to `key` via currency lookup
2. Raw `amount` (micro-units) → kept as-is for frontend coin() compatibility
3. Added `amount_usd` calculated from price × human-readable amount
4. Added `total_value_usd` sum

### Step 3: Frontend Display

```typescript
// In component
const balances = balancesStore.balances;
// Format amount: "1500000000" → "1,500.00 NLS"
const formatted = formatAmount(balance.amount, balance.decimal_digits);
```

---

## 4. Lease Data Flow

Leases are leveraged positions that combine on-chain state with historical ETL data.

### Flow Diagram

```
┌─────────────────┐  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Leaser Contract │  │  ETL API        │     │  Rust Backend   │     │  Vue Frontend   │
│ + Lease Contract│  │  (Analytics)    │     │                 │     │                 │
└────────┬────────┘  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                    │                       │                       │
         │  customer_leases   │                       │                       │
         ├───────────────────────────────────────────>│                       │
         │                    │                       │                       │
         │  [lease_addr1, ...]│                       │                       │
         │<───────────────────────────────────────────│                       │
         │                    │                       │                       │
         │  For each lease:   │                       │                       │
         │  query state       │                       │                       │
         ├───────────────────────────────────────────>│                       │
         │                    │                       │                       │
         │                    │  /ls-opening/{addr}   │                       │
         │                    ├──────────────────────>│                       │
         │                    │                       │                       │
         │                    │                       │  Merge On-Chain +     │
         │                    │                       │  ETL Data             │
         │                    │                       │                       │
         │                    │                       │  GET /api/leases      │
         │                    │                       │<──────────────────────│
         │                    │                       │                       │
         │                    │                       │  LeasesResponse       │
         │                    │                       ├──────────────────────>│
```

### Step 1: Leaser Contract Query

**Source:** `backend/src/external/chain.rs`

```rust
// Get all lease addresses for an owner
let query_msg = format!(r#"{{"customer_leases":{{"customer":"{}"}}}}"#, owner);
```

**Response:**
```json
["nolus1lease123...", "nolus1lease456..."]
```

### Step 2: Individual Lease State Query

For each lease address:

```rust
let query_msg = r#"{"state":{}}"#;
```

**Raw Lease State (Opened):**
```json
{
  "opened": {
    "amount": { "ticker": "ATOM", "amount": "10000000" },
    "loan": {
      "principal_due": { "ticker": "USDC_NOBLE", "amount": "35000000" },
      "annual_interest_rate": 120,
      "interest_paid": 0
    },
    "close_policy": {
      "stop_loss": 850,
      "take_profit": 1200
    },
    "overdue_collect_in": "86400000000000"
  }
}
```

### Step 3: ETL Data Enrichment

**Source:** `backend/src/external/etl.rs`

```rust
// GET /ls-opening/{lease_address}
let url = format!("{}/ls-opening/{}", self.base_url, lease_address);
```

**ETL Response:**
```json
{
  "downpayment_amount": "15.00",
  "price": "4.50",
  "fee": "0.25",
  "ls_asset_symbol": "ATOM"
}
```

### Step 4: Backend Merge & Transform

**Source:** `backend/src/handlers/leases.rs`

The handler merges on-chain state with ETL historical data:

```rust
LeaseInfo {
    address: lease_address,
    protocol: protocol_name,
    status: "opened",
    amount: LeaseAssetInfo {
        ticker: "ATOM",
        amount: "10000000",
        amount_usd: Some("45.00"),  // Calculated: amount × current_price
    },
    debt: LeaseDebtInfo {
        ticker: "USDC_NOBLE",
        principal: "35000000",
        total: "35500000",  // principal + interest
        total_usd: Some("35.50"),
    },
    interest: LeaseInterestInfo {
        annual_rate_percent: 12.0,  // 120 permille → 12%
    },
    liquidation_price: Some("3.20"),  // Calculated from LTV
    pnl: Some(LeasePnlInfo {
        amount: "0",         // Not calculated by backend (ETL doesn't provide pnl field)
        percent: "0",        // Not calculated by backend
        downpayment: "15.00",
    }),
    // Note: PnL is calculated on the frontend by LeaseCalculator.calculatePnl()
    // using: equity = assetValueUsd - totalDebtUsd; pnl = equity - downPayment
    close_policy: Some(LeaseClosePolicy {
        stop_loss: Some(850),    // 85% of entry price
        take_profit: Some(1200), // 120% of entry price
    }),
    etl_data: Some(LeaseEtlData {
        downpayment_amount: Some("15.00"),
        price: Some("4.50"),
        fee: Some("0.25"),
    }),
}
```

**GET /api/leases?owner=nolus1... Response:**
```json
{
  "leases": [
    {
      "address": "nolus1lease123...",
      "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "status": "opened",
      "amount": {
        "ticker": "ATOM",
        "amount": "10000000",
        "amount_usd": "45.00"
      },
      "debt": {
        "ticker": "USDC_NOBLE",
        "principal": "35000000",
        "total": "35500000",
        "total_usd": "35.50"
      },
      "interest": {
        "annual_rate_percent": 12.0
      },
      "liquidation_price": "3.20",
      "pnl": {
        "amount": "0",
        "percent": "0",
        "downpayment": "15.00"
      },
      "close_policy": {
        "stop_loss": 850,
        "take_profit": 1200
      }
    }
  ],
  "total_collateral_usd": "45.00",
  "total_debt_usd": "35.50"
}
```

### Config Impact on Leases

**Config file:** `backend/config/gated/lease-rules.json` (downpayment_ranges section)

Controls min/max downpayment amounts per protocol and asset. Served via `GET /api/leases/config/{protocol}` merged with on-chain LeaserConfig data (`min_asset`, `min_transaction`).

```json
{
  "OSMOSIS-OSMOSIS-USDC_NOBLE": {
    "ATOM": { "min": 40.0, "max": 6000.0 },
    "ALL_BTC": { "min": 40.0, "max": 10000.0 }
  }
}
```

**Config file:** `backend/config/lease/ignore-lease-long-assets.json`

Assets that cannot be used for long positions:

```json
["USDC", "USDC_AXELAR", "ST_ATOM", "TIA"]
```

**Config file:** `backend/config/lease/free-interest-assets.json`

Assets with zero interest promotions:

```json
["ALL_BTC@OSMOSIS-OSMOSIS-USDC_NOBLE", "USDC_NOBLE@OSMOSIS-OSMOSIS-ALL_BTC"]
```

### Frontend PnL Calculation

The backend `pnl.amount` and `pnl.percent` fields are always `"0"` because the ETL `ls-opening` endpoint doesn't include a `pnl` field. PnL is calculated entirely on the frontend by `LeaseCalculator.calculatePnl()`:

```typescript
// equity = current asset value in USD - total debt in USD
// pnlAmount = equity - downPayment (from ETL data)
// pnlPercent = (pnlAmount / downPayment) * 100
const { pnlAmount, pnlPercent, pnlPositive } = leaseCalculator.calculatePnl(
  assetValueUsd, totalDebtUsd, downPayment
);
```

The `downpayment` value comes from the backend's `pnl.downpayment` field (sourced from ETL `ls-opening.downpayment_amount`).

### Leases Summary Reactivity Pattern

The `Leases.vue` component uses **ref-based state** for summary totals (PnL, Value, Debt) rather than computed properties. These are recalculated by `setLeases()` via a watch:

```typescript
watch(
  [() => leases.value, () => pricesStore.prices],
  () => { setLeases(); },
  { deep: true, immediate: true }
);
```

**Critical: both `deep` and `immediate` are required:**
- `immediate: true` — On SPA navigation, leases are already in the store from `connectionStore.connectWallet()`. Without `immediate`, the watch never fires and summary stays at $0.00.
- `deep: true` — Prices object mutations (from polling/WebSocket) need to trigger recalculation.
- Watching `pricesStore.prices` — Summary depends on current prices via `LeaseCalculator.calculateDisplayData()`. Without this, price updates don't refresh the summary.

Individual lease rows don't have this issue because `leasesData` is a `computed` property that automatically tracks reactive dependencies (including `pricesStore.prices` accessed inside `getLeaseDisplayData()`).

**Pattern rule:** Any `ref`-based aggregation that depends on store data from multiple sources must watch all dependencies with `{ immediate: true }`. See `AssetsTable.vue` for the same correct pattern.

---

## 5. Earn Data Flow

Earn pools are liquidity provider positions in LPP (Liquidity Provider Pool) contracts.

### Flow Diagram

```
┌─────────────────┐  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  LPP Contracts  │  │  ETL API        │     │  Rust Backend   │     │  Vue Frontend   │
│  (8 protocols)  │  │  (APY data)     │     │                 │     │                 │
└────────┬────────┘  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                    │                       │                       │
         │  lpp_balance       │                       │                       │
         │  deposit_capacity  │                       │                       │
         ├───────────────────────────────────────────>│                       │
         │                    │                       │                       │
         │                    │  /pools (APY)         │                       │
         │                    ├──────────────────────>│                       │
         │                    │                       │                       │
         │                    │                       │  Merge                │
         │                    │                       │                       │
         │                    │                       │  GET /api/earn/pools  │
         │                    │                       │<──────────────────────│
         │                    │                       │                       │
         │                    │                       │  PoolsResponse        │
         │                    │                       ├──────────────────────>│
```

### Step 1: LPP Contract Queries

```rust
// Query: LPP balance (total deposited)
let balance = chain_client.get_lpp_balance(&lpp_address).await?;

// Query: Deposit capacity
let capacity = chain_client.get_deposit_capacity(&lpp_address).await?;

// Query: User's deposit (if address provided)
let deposit = chain_client.get_lender_deposit(&lpp_address, &user_address).await?;
```

### Step 2: ETL APY Data

```json
{
  "pools": [
    {
      "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "apy": 12.5,
      "utilization": 75.5
    }
  ]
}
```

### Step 3: Backend Response

**GET /api/earn/pools Response:**
```json
[
  {
    "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
    "lpp_address": "nolus1ueytzwqyadm6r0z8ajse7g6gzum4w3vv04qazctf8ugqrrej6n4sq027cf",
    "currency": "USDC_NOBLE",
    "total_deposited": "1000000000000",
    "total_deposited_usd": "1000000.00",
    "apy": 12.5,
    "utilization": 75.5,
    "available_liquidity": "250000000000",
    "deposit_capacity": "1500000000000"
  }
]
```

**GET /api/earn/positions?address=nolus1... Response:**
```json
{
  "positions": [
    {
      "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
      "lpp_address": "nolus1...",
      "currency": "USDC_NOBLE",
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

**Key transformation:** `deposited_nlpn` (nLPN tokens) × `lpp_price` = `deposited_lpn` (actual value).

---

## 6. Staking Data Flow

Staking data comes from the Cosmos SDK staking and distribution modules.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Staking Module │     │  Rust Backend   │     │  Vue Frontend   │
│  + Distribution │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  /staking/validators  │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  /staking/delegations │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  /distribution/rewards│                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │                       │  Merge & Transform    │
         │                       │                       │
         │                       │  GET /api/staking/*   │
         │                       │<──────────────────────│
```

### Step 1: Validators Query

**Raw Response:**
```json
{
  "validators": [
    {
      "operator_address": "nolusvaloper1qe8uuf5x69c526h4nzxwv4ltftr73v7q04pre5",
      "description": {
        "moniker": "Stakecito",
        "identity": "D16E26E5C8154E17",
        "website": "https://stakecito.com/"
      },
      "commission": {
        "commission_rates": {
          "rate": "0.050000000000000000"
        }
      },
      "tokens": "9806234167662",
      "status": "BOND_STATUS_BONDED",
      "jailed": false
    }
  ]
}
```

### Step 2: Backend Transform

**GET /api/staking/validators Response:**
```json
[
  {
    "operator_address": "nolusvaloper1qe8uuf5x69c526h4nzxwv4ltftr73v7q04pre5",
    "moniker": "Stakecito",
    "identity": "D16E26E5C8154E17",
    "website": "https://stakecito.com/",
    "commission_rate": "0.050000000000000000",
    "tokens": "9806234167662",
    "status": "bonded",
    "jailed": false
  }
]
```

**Transformations:**
1. Flattened nested `description` object
2. Flattened `commission.commission_rates`
3. Simplified status: `BOND_STATUS_BONDED` → `bonded`

### Step 3: Staking Positions

**GET /api/staking/positions?address=nolus1... Response:**
```json
{
  "delegations": [
    {
      "validator_address": "nolusvaloper1...",
      "validator_moniker": "Stakecito",
      "shares": "1000000000",
      "balance": { "denom": "unls", "amount": "1000000000" }
    }
  ],
  "unbonding": [
    {
      "validator_address": "nolusvaloper1...",
      "entries": [
        {
          "completion_time": "2026-02-14T10:00:00Z",
          "balance": "500000000"
        }
      ]
    }
  ],
  "rewards": [
    {
      "validator_address": "nolusvaloper1...",
      "rewards": [{ "denom": "unls", "amount": "50000" }]
    }
  ],
  "total_staked": "1000000000",
  "total_rewards": "50000"
}
```

---

## 7. Swap Data Flow

Swaps use the Skip API for cross-chain routing. The frontend constrains routes to **IBC-only bridges** and filters swap venues to the **user's selected network** for direct routing (e.g., Nolus → Osmosis → Nolus).

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                       │
├────────────────┬─────────────────┬──────────────────────────────────────────┤
│  Skip API      │  ETL API        │  Config Files                            │
│  (Swap Router) │  (Currencies)   │  swap-settings.json + network-config.json│
└───────┬────────┘────────┬────────┘──────────────────┬───────────────────────┘
        │                 │                            │
        │                 │                            │
        ▼                 ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RUST BACKEND                                           │
│                                                                              │
│  GET /api/swap/config                                                       │
│    1. Load swap-settings.json (tickers, slippage, fees)                     │
│    2. Load network-config.json (swap venues, chain IDs)                     │
│    3. Load ETL currencies + protocols (cached)                              │
│    4. Resolve tickers → IBC denoms via ETL data                            │
│    5. Build Cosmos transfers dynamically from ETL                           │
│    6. Build swap_venues from network config                                 │
│                                                                              │
│  POST /api/swap/route    → proxy to Skip /v2/fungible/route                │
│  POST /api/swap/messages → proxy to Skip /v2/fungible/msgs                 │
│  POST /api/swap/track    → proxy to Skip /v2/tx/track                      │
│  GET  /api/swap/status   → proxy to Skip /v2/tx/status                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                              │
        ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VUE FRONTEND                                           │
│                                                                              │
│  SwapForm.vue:                                                              │
│    1. Fetch skip-route config                                               │
│    2. Filter swap_venues to match user's selected network                   │
│    3. Send route request with bridges: ["IBC"] + filtered venue             │
│    4. Display route quote, execute swap on approval                         │
│                                                                              │
│  SkipRoute.ts:                                                              │
│    - bridges: ["IBC"] (only IBC bridges supported, no CCTP)                 │
│    - experimental_features: ["stargate", "eureka"]                          │
│                                                                              │
│  balancesStore (filteredBalances):                                           │
│    - Deduplicates by ticker, preferring denom from current network          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Skip Route Config

The frontend fetches `GET /api/swap/config` which returns swap settings with resolved denoms, venues, and transfer mappings. See [API.md](./api.md#get-apiswapconfig) for the full response shape.

**Key config sources:**

| Data | Source | How |
|------|--------|-----|
| Swap currency denoms | ETL currencies + `swap-settings.json` tickers | Ticker (e.g., `"USDC_NOBLE"`) resolved to IBC denom via ETL `bank_symbol` |
| Swap venues | `network-config.json` per-network `swap_venue` | Name + address from config, `chain_id` from network's `chain_id` field |
| Cosmos transfers | ETL currencies + protocols | `bank_symbol` → `dex_symbol` per protocol, grouped by network (Osmosis, Neutron) |
| Static settings | `swap-settings.json` | `slippage`, `fee`, `gas_multiplier`, `blacklist`, etc. |

### Step 2: Venue Filtering (Frontend)

**Source:** `src/modules/assets/components/SwapForm.vue`

The frontend filters swap venues to only include the venue matching the user's selected network:

```typescript
const config = await getSkipRouteConfig();
const network = configStore.protocolFilter.toLowerCase();
const venue = config.swap_venues.find((v) => v.chain_id.startsWith(network));
const options = venue ? { swap_venues: [venue] } : {};
```

This ensures routes go through a single DEX (e.g., Osmosis Poolmanager when on Osmosis), preventing multi-hop routes through unrelated chains.

### Step 3: Route Request

**Source:** `src/common/utils/SkipRoute.ts`

```typescript
// Route request constrains to IBC-only bridges
{
  source_asset_denom: "unls",
  source_asset_chain_id: "pirin-1",
  dest_asset_denom: "ibc/F5FABF52...",  // USDC on Osmosis
  dest_asset_chain_id: "osmosis-1",
  amount_in: "1000000000",
  bridges: ["IBC"],  // Only IBC bridges (CCTP not supported)
  swap_venues: [{ "name": "osmosis-poolmanager", "chain_id": "osmosis-1" }],
  experimental_features: ["stargate", "eureka"]
}
```

### Step 4: Skip API Response

```json
{
  "amount_in": "1000000000",
  "amount_out": "8250000",
  "operations": [
    {
      "transfer": {
        "from_chain_id": "pirin-1",
        "to_chain_id": "osmosis-1",
        "port": "transfer",
        "channel": "channel-0"
      }
    },
    {
      "swap": {
        "swap_venue": { "name": "osmosis-poolmanager", "chain_id": "osmosis-1" },
        "pool_id": "1797"
      }
    },
    {
      "transfer": {
        "from_chain_id": "osmosis-1",
        "to_chain_id": "pirin-1",
        "port": "transfer",
        "channel": "channel-783"
      }
    }
  ],
  "chain_ids": ["pirin-1", "osmosis-1", "pirin-1"],
  "swap_price_impact_percent": "0.15"
}
```

With `bridges: ["IBC"]` and a single venue, routes are direct 3-chain hops (Nolus → DEX chain → Nolus).

### Step 5: Balance Deduplication

**Source:** `src/common/stores/balances/index.ts`

When the same ticker exists with different IBC denoms per network (e.g., USDC_NOBLE on Osmosis vs Neutron), `filteredBalances` prefers the denom whose protocol belongs to the user's selected network:

```typescript
const seenTickers = new Map<string, number>(); // ticker -> index in result
const networkProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);

// If ticker already seen, replace only if this currency belongs to current network
const existingIndex = seenTickers.get(ticker);
if (existingIndex !== undefined) {
  const belongsToNetwork = networkProtocols.includes(currency.protocol);
  if (belongsToNetwork) {
    result[existingIndex] = entry;
  }
  continue;
}
```

This ensures the swap form uses the correct IBC denom for the selected network.

### Config Files

**`backend/config/gated/swap-settings.json`** — Uses tickers (resolved at runtime):

```json
{
  "api_url": "https://api.skip.money",
  "blacklist": [],
  "slippage": 1,
  "gas_multiplier": 2,
  "fee": 35,
  "fee_address": "",
  "timeoutSeconds": "60",
  "swap_currencies": {
    "osmosis": "USDC_NOBLE",
    "neutron": "USDC_NOBLE"
  },
  "swap_to_currency": "NLS"
}
```

**`backend/config/gated/network-config.json`** — Swap venues per network (only Osmosis and Neutron):

```json
{
  "OSMOSIS": {
    "swap_venue": { "name": "osmosis-poolmanager", "address": "osmo14p4cu64dlwavj7kga4s3mj6xglucj9t358r5mz" }
  },
  "NEUTRON": {
    "swap_venue": { "name": "neutron-astroport", "address": "neutron1war9ee549tt9rla54g56ca78y969l6239pang9" }
  }
}
```

- `swap_currencies`: Ticker per network, resolved to IBC denom via ETL
- `swap_to_currency`: Target ticker, resolved to denom via ETL
- `swap_venue`: Per-network DEX venue with contract address
- `blacklist`: Denoms that cannot be swapped
- `slippage`: Default slippage percentage

---

## 8. Governance Data Flow

Governance proposals come from the Cosmos SDK governance module.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Gov Module    │     │  Rust Backend   │     │  Vue Frontend   │
│  (Nolus Chain)  │     │  + Config       │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  /gov/v1/proposals    │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  All proposals        │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │                       │  Filter hidden        │
         │                       │  proposals            │
         │                       │                       │
         │                       │  GET /api/governance  │
         │                       │<──────────────────────│
```

### Step 1: Raw Proposals

```json
{
  "proposals": [
    {
      "id": "324",
      "status": "PROPOSAL_STATUS_PASSED",
      "final_tally_result": {
        "yes_count": "145576376018867",
        "abstain_count": "100000000000",
        "no_count": "0",
        "no_with_veto_count": "0"
      },
      "submit_time": "2025-12-18T09:14:17.418735710Z",
      "voting_end_time": "2025-12-19T09:14:17.418735710Z",
      "title": "Update Oracle Swap Tree (Osmosis axlUSDC)",
      "summary": "## Summary\nThis proposal seeks to optimize..."
    }
  ]
}
```

### Step 2: Config Filtering

**Config file:** `backend/config/governance/hidden-proposals.json`

```json
{
  "hide": ["109", "108", "106", "105", "129", "164", "192", "196"]
}
```

The backend filters out proposals with IDs in this list before returning to the frontend.

### Step 3: Backend Response

**GET /api/governance/proposals Response:**
```json
{
  "proposals": [
    {
      "id": "324",
      "status": "PROPOSAL_STATUS_PASSED",
      "final_tally_result": {
        "yes_count": "145576376018867",
        "abstain_count": "100000000000",
        "no_count": "0",
        "no_with_veto_count": "0"
      },
      "submit_time": "2025-12-18T09:14:17.418735710Z",
      "voting_end_time": "2025-12-19T09:14:17.418735710Z",
      "title": "Update Oracle Swap Tree (Osmosis axlUSDC)",
      "summary": "## Summary..."
    }
  ],
  "pagination": {
    "total": "324",
    "next_key": null
  }
}
```

---

## 9. WebSocket Real-Time Updates

WebSocket enables real-time data push for prices, balances, leases, and transaction status.

### Connection Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vue Frontend  │     │  Rust Backend   │     │  External APIs  │
│                 │     │  (WS Manager)   │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  WS Connect /ws       │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  { type: "subscribe", │                       │
         │    topic: "prices" }  │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │  { type: "subscribed",│                       │
         │    topic: "prices" }  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │                       │  CometBFT NewBlock    │
         │                       │  event (~6s, every    │
         │                       │  other block) triggers│
         │                       │  Oracle query         │
         │                       ├──────────────────────>│
         │                       │                       │
         │  { type: "price_update",                      │
         │    prices: {...} }    │                       │
         │<──────────────────────│                       │
```

### Backend Event Architecture

Chain-driven data is refreshed via CometBFT WebSocket event subscriptions (`chain_events.rs`) instead of fixed-interval timers:

```
CometBFT /websocket ──► ChainEventClient
                              │
                    ┌─────────┴──────────┐
                    │                    │
            broadcast<u64>       broadcast<ContractExecEvent>
            (NewBlock height)    (wasm contract executions)
                    │                    │
              ┌─────┴─────┐       ┌──────┴──────────┐
              │           │       │                  │
        refresh_prices  price_   lease_monitor   earn_monitor
        (every 2nd     update    (500ms debounce) (10s debounce)
         block ~6s)    (every 2nd
                        block)
```

| Task | Trigger | Freshness |
|------|---------|-----------|
| `refresh_prices` | NewBlock (every 2nd block) | ~6s |
| `start_price_update_task` | NewBlock (every 2nd block) | ~6s |
| `start_lease_monitor_task` | Tx wasm event + 500ms debounce | ~3.5s |
| `start_earn_monitor_task` | Tx wasm event + 10s debounce | 10-15s |
| `start_skip_tracking_task` | 5s timer (Skip API, no chain events) | 5s |

ETL/disk data (config, pools, validators, stats, etc.) stays on fixed-interval timers (30s–300s).

### Message Types

**Client → Server:**

```json
// Subscribe to prices (no auth required)
{ "type": "subscribe", "topic": "prices" }

// Subscribe to user-specific data (requires address)
{ "type": "subscribe", "topic": "leases", "address": "nolus1..." }
{ "type": "subscribe", "topic": "balances", "address": "nolus1..." }

// Track a swap transaction
{ "type": "subscribe", "topic": "skip_tx", "tx_hash": "ABC...", "source_chain": "osmosis-1" }

// Unsubscribe
{ "type": "unsubscribe", "topic": "prices" }

// Ping (keepalive)
{ "type": "ping" }
```

**Server → Client:**

```json
// Subscription confirmed
{ "type": "subscribed", "topic": "prices" }

// Pong response
{ "type": "pong" }

// Price update (every 30s or on change)
{
  "type": "price_update",
  "prices": {
    "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE": {
      "key": "ATOM@OSMOSIS-OSMOSIS-USDC_NOBLE",
      "symbol": "ATOM",
      "price_usd": "4.55"
    }
  }
}

// Lease state change
{
  "type": "lease_update",
  "lease": {
    "address": "nolus1lease...",
    "status": "opened",
    "pnl": { "amount": "10.50", "percent": "70.0" }
  }
}

// Balance change
{
  "type": "balance_update",
  "address": "nolus1...",
  "balances": [...]
}

// Skip swap progress
{
  "type": "skip_tx_update",
  "tx_hash": "ABC...",
  "state": "STATE_COMPLETED",
  "transfer_sequence": [...]
}
```

### Frontend WebSocket Client

**Source:** `src/common/api/WebSocketClient.ts`

```typescript
// Subscribe to prices
const unsubscribe = WebSocketClient.subscribePrices((prices) => {
  pricesStore.updatePrices(prices);
});

// Subscribe to leases for current user
const unsubscribe = WebSocketClient.subscribeLeases(address, (lease) => {
  leasesStore.updateLease(lease);
});

// Cleanup on unmount
onUnmounted(() => {
  unsubscribe();
});
```

---

## 10. Referral Program Data Flow

The referral program allows users to earn rewards by referring others. Data flows through an external Referral Program service.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Referral Program│     │  Rust Backend   │     │  Vue Frontend   │
│    Service      │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │  POST /api/referral/* │
         │                       │<──────────────────────│
         │                       │                       │
         │  Bearer Token Auth    │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  Referral Data        │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │                       │  Response             │
         │                       ├──────────────────────>│
```

### Backend Implementation

**Handler:** `backend/src/handlers/referral.rs`
**Client:** `backend/src/external/referral.rs`

All endpoints check `is_fully_configured()` before processing:

```rust
if !state.referral_client.is_fully_configured() {
    return Err(AppError::ExternalApi {
        api: "Referral".to_string(),
        message: "Referral service not configured".to_string(),
    });
}
```

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/referral/validate/:code` | GET | Validate referral code (public) |
| `/api/referral/register` | POST | Register as referrer |
| `/api/referral/stats/:address` | GET | Get referrer statistics |
| `/api/referral/rewards/:address` | GET | Get rewards history |
| `/api/referral/payouts/:address` | GET | Get payout history |
| `/api/referral/referrals/:address` | GET | Get referred users list |
| `/api/referral/assign` | POST | Assign referral to wallet |

### Data Transform Example

**External Service Response:**
```json
{
  "referrer": {
    "wallet_address": "nolus1...",
    "tier": "General"
  },
  "stats": {
    "total_referrals": 15,
    "pending_rewards": "50000000"
  }
}
```

**Backend Response (tier lowercased):**
```json
{
  "referrer": {
    "wallet_address": "nolus1...",
    "tier": "general"
  },
  "stats": {
    "total_referrals": 15,
    "pending_rewards": "50000000"
  }
}
```

### Frontend Store

**Store:** `src/common/stores/referrals/index.ts`

```typescript
const referralsStore = useReferralsStore();

// Initialize for wallet
await referralsStore.initialize(walletAddress);

// Access computed properties
referralsStore.isReferrer;     // boolean
referralsStore.referralCode;   // string
referralsStore.pendingRewards; // string
referralsStore.referralLink;   // full URL
```

See [REFERRAL_PROGRAM.md](./REFERRAL_PROGRAM.md) for complete documentation.

---

## 11. Zero-Interest Campaigns Data Flow

Zero-interest campaigns provide promotional periods for free interest payments. Data flows through the Payments Manager service.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Payments     │     │  Rust Backend   │     │  Vue Frontend   │
│    Manager      │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │  GET /api/campaigns/* │
         │                       │<──────────────────────│
         │                       │                       │
         │  /api/v1/campaigns/*  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  { success, data }    │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │                       │  Unwrap & Transform   │
         │                       │                       │
         │                       │  Campaign Data        │
         │                       ├──────────────────────>│
```

### Backend Implementation

**Handler:** `backend/src/handlers/zero_interest.rs`
**Client:** `backend/src/external/zero_interest.rs`

The handler provides two categories of endpoints:

**Zero-Interest Payments (6 endpoints):**
- Payment CRUD operations (create, cancel, get by owner/lease)
- Configuration and eligibility checks

**Campaign Display (2 endpoints):**
- Active campaigns list
- Campaign eligibility check

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/zero-interest/config` | GET | Get payment configuration |
| `/api/zero-interest/eligibility` | GET | Check payment eligibility |
| `/api/zero-interest/payments/:owner` | GET | Get owner's payments |
| `/api/zero-interest/lease/:addr/payments` | GET | Get lease payments |
| `/api/zero-interest/payments` | POST | Create payment |
| `/api/zero-interest/payments/:id` | DELETE | Cancel payment |
| `/api/campaigns/active` | GET | Get active campaigns |
| `/api/campaigns/eligibility` | GET | Check campaign eligibility |

### Data Transform Example

The Payments Manager wraps responses in a standard format:

**Payments Manager Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [...],
    "all_eligible_currencies": ["ALL_BTC"],
    "has_universal_campaign": false
  }
}
```

**Backend Response (unwrapped):**
```json
{
  "campaigns": [...],
  "all_eligible_currencies": ["ALL_BTC"],
  "has_universal_campaign": false
}
```

### Frontend Store

**Store:** `src/common/stores/campaigns/index.ts`

```typescript
const campaignsStore = useCampaignsStore();

// Load campaigns
await campaignsStore.loadCampaigns();

// Quick eligibility check (uses aggregated data)
campaignsStore.isEligible("ALL_BTC", "OSMOSIS-OSMOSIS-USDC_NOBLE");

// Full eligibility check (includes wallet-specific rules)
await campaignsStore.checkFullEligibility(wallet, protocol, currency);
```

See [ZERO_INTEREST_CAMPAIGNS.md](./ZERO_INTEREST_CAMPAIGNS.md) for complete documentation.

---

## 12. Translation Management Data Flow

The translation system uses AI-powered generation with an approval workflow.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OpenAI API    │     │  Rust Backend   │     │  Admin Client   │
│                 │     │  + File Storage │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │  POST /admin/.../sync │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  Compare locales      │
         │                       │  Detect missing keys  │
         │                       │                       │
         │                       │  POST /.../generate   │
         │                       │<──────────────────────│
         │                       │                       │
         │  Translate batch      │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  Translations         │                       │
         ├──────────────────────>│                       │
         │                       │                       │
         │                       │  Store in pending     │
         │                       │  queue                │
         │                       │                       │
         │                       │  POST /.../approve    │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  Move to active       │
         │                       │  locales              │
```

### Backend Implementation

**Handler:** `backend/src/handlers/translations.rs`
**Storage:** `backend/src/translations/storage.rs`
**OpenAI Client:** `backend/src/translations/openai.rs`
**Audit:** `backend/src/translations/audit.rs`

### Endpoints (Admin API)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/translations/sync` | POST | Detect missing keys |
| `/admin/translations/missing` | GET | List missing keys |
| `/admin/translations/generate` | POST | AI translation generation |
| `/admin/translations/pending` | GET | List pending translations |
| `/admin/translations/pending/:id` | GET | Get single pending |
| `/admin/translations/pending/:id/approve` | POST | Approve translation |
| `/admin/translations/pending/:id/reject` | POST | Reject translation |
| `/admin/translations/pending/:id/edit` | POST | Edit and approve |
| `/admin/translations/pending/approve-batch` | POST | Bulk approve |
| `/admin/translations/active` | GET | Get active translations |
| `/admin/translations/active/:lang/:key` | PUT | Direct edit |
| `/admin/translations/languages` | GET/POST | Language management |
| `/admin/translations/audit` | GET | Audit log |
| `/admin/translations/key-history/:lang/:key` | GET | Key history |

### Public Endpoints (Frontend)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/locales/:lang` | GET | Get translations for language |

### Data Transform Example

**OpenAI Response:**
```json
{
  "translations": [
    {
      "key": "common.loading",
      "source_value": "Loading...",
      "translated_value": "Загрузка...",
      "placeholders_valid": true
    }
  ]
}
```

**Pending Translation (stored):**
```json
{
  "id": "uuid",
  "source_key": "common.loading",
  "source_value": "Loading...",
  "target_lang": "ru",
  "proposed_value": "Загрузка...",
  "placeholders_valid": true,
  "status": "pending",
  "source": "ai_generated",
  "ai_model": "gpt-4o-mini",
  "batch_id": "batch-uuid"
}
```

### Translation Context

AI translations receive domain context (hardcoded in handler):

```
Nolus is a DeFi money market protocol built on Cosmos SDK.

Key concepts:
- Lease: A leveraged position where users borrow to amplify exposure
- LTV (Loan-to-Value): Ratio of borrowed amount to total position value
- Liquidation: Automatic position closure when LTV exceeds threshold
...
```

### Built-in Glossary (Never Translated)

- Protocol names: Nolus, NLS, Cosmos, IBC
- Cryptocurrency: USDC, ATOM, OSMO
- Technical terms: DeFi, APR, TVL, LTV

See [TRANSLATIONS.md](./TRANSLATIONS.md) for complete documentation.

---

## Configuration Reference

### Backend Config Files

| File | Purpose | Used By |
|------|---------|---------|
| `backend/config/networks.json` | Network definitions (chain_id, prefix, gas) | Config handler |
| `backend/config/currencies.json` | Currency metadata (CoinGecko IDs, symbols) | Prices, balances |
| `backend/config/chain-ids.json` | Chain ID mappings (OSMOSIS → osmosis-1) | Swap routing |
| `backend/config/gated/lease-rules.json` | Downpayment ranges, asset restrictions | Lease validation |
| `backend/config/lease/ignore-assets.json` | Assets excluded from all leases | Lease UI |
| `backend/config/lease/ignore-lease-long-assets.json` | Assets excluded from long positions | Long form |
| `backend/config/lease/ignore-lease-short-assets.json` | Assets excluded from short positions | Short form |
| `backend/config/lease/free-interest-assets.json` | Assets with 0% interest promo | Lease display |
| `backend/config/lease/due-projection-secs.json` | Time projection for interest calc | Lease interest |
| `backend/config/gated/swap-settings.json` | Skip API settings, slippage, swap currency tickers | Swap config handler |
| `backend/config/governance/hidden-proposals.json` | Proposal IDs to hide | Governance |
| `backend/config/zero-interest/config.json` | Zero interest program addresses | Zero interest |
| `backend/config/locales/*.json` | i18n translations | Localization |

### Environment Variables

**Backend (.env):**
```env
# Chain connections
NOLUS_RPC_URL=https://rpc.nolus.network
NOLUS_REST_URL=https://lcd.nolus.network
ADMIN_CONTRACT=nolus1...
DISPATCHER_CONTRACT=nolus1...

# External APIs
ETL_API_URL=https://etl-internal.nolus.network/api
SKIP_API_URL=https://api.skip.money

# Referral Program (optional)
REFERRAL_API_URL=http://localhost:3000
REFERRAL_API_TOKEN=your-api-token

# Zero Interest / Payments Manager (optional)
ZERO_INTEREST_API_URL=http://localhost:8080
ZERO_INTEREST_API_TOKEN=your-api-token

# Translation Admin (optional)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
ADMIN_API_ENABLED=true
ADMIN_API_KEY=your-secure-admin-key
```

**Frontend (.env.spa):**
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
VITE_APP_NETWORKS=mainnet
```

### Caching Summary

| Data Type | Backend Cache TTL | Frontend Cache | Refresh Strategy |
|-----------|-------------------|----------------|------------------|
| Prices | ~6 seconds | 5 min localStorage | CometBFT NewBlock event (every 2nd block) + WebSocket push |
| Config | 1 hour | 1 hour localStorage | On-demand |
| Currencies | 1 hour | Derived from config | On-demand |
| Validators | 5 minutes | None | On-demand |
| User balances | None (real-time) | None | WebSocket |
| User leases | None (real-time) | None | CometBFT Tx wasm event (500ms debounce) + WebSocket push |
| Earn pools | 5 minutes | None | CometBFT Tx wasm event (10s debounce) |
| Stats (TVL, etc.) | 5 minutes | 5 min localStorage | On-demand |
| User analytics | None | In-memory only | On wallet connect |

---

## 16. Stats Data Flow (useStatsStore)

The `useStatsStore` consolidates all global protocol statistics that don't require a user wallet.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    ETL API      │     │  Rust Backend   │     │  useStatsStore  │     │  Vue Components │
│  (Analytics)    │     │   (Proxy)       │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │                       │
         │                       │  initialize()         │                       │
         │                       │<──────────────────────│                       │
         │                       │                       │                       │
         │  Batch: stats-overview│                       │                       │
         │<──────────────────────│                       │                       │
         │                       │                       │                       │
         │  {tvl, tx_volume,     │                       │                       │
         │   buyback, pnl, rev}  │                       │                       │
         ├──────────────────────>│                       │                       │
         │                       │                       │                       │
         │  Batch: loans-stats   │                       │                       │
         │<──────────────────────│                       │                       │
         │                       │                       │                       │
         │  {position_value,     │                       │                       │
         │   open_interest}      │                       │                       │
         ├──────────────────────>│                       │                       │
         │                       │                       │                       │
         │                       │  Store + Cache        │                       │
         │                       ├──────────────────────>│                       │
         │                       │                       │                       │
         │                       │                       │  statsStore.overview  │
         │                       │                       │<──────────────────────│
```

### Data Managed by useStatsStore

| State | Source | Description |
|-------|--------|-------------|
| `overview` | `/api/etl/batch/stats-overview` | TVL, tx volume, buyback, realized PnL stats, revenue |
| `loansStats` | `/api/etl/batch/loans-stats` | Open position value, open interest |
| `leasedAssets` | `/api/etl/leased-assets` | Asset distribution chart data |
| `monthlyLeases` | `/api/etl/lease-monthly` | Monthly lease volume chart data |
| `supplyBorrowHistory` | `/api/etl/time-series` | Supply/borrow history for charts |

### Caching Strategy

- **localStorage cache** with 5-minute TTL
- **Optimistic loading**: Shows cached data immediately, then fetches fresh data
- Initialized once on app startup via `useConnectionStore.initializeApp()`

### Component Usage

```typescript
// In stats components (Overview.vue, LoansProvided.vue, etc.)
import { useStatsStore } from "@/common/stores";

const statsStore = useStatsStore();

// Access computed properties
const tvl = computed(() => statsStore.overview.tvl);
const loading = computed(() => statsStore.overviewLoading && !statsStore.hasOverviewData);

// For charts
const leasedAssets = computed(() => statsStore.leasedAssets);
const monthlyLeases = computed(() => statsStore.monthlyLeases);
```

---

## 17. Analytics Data Flow (useAnalyticsStore)

The `useAnalyticsStore` manages user-specific analytics data that requires a wallet address.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    ETL API      │     │  Rust Backend   │     │useAnalyticsStore│     │  Vue Components │
│  (Analytics)    │     │   (Proxy)       │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │                       │
         │                       │  setAddress(wallet)   │                       │
         │                       │<──────────────────────│                       │
         │                       │                       │                       │
         │  Batch: user-dashboard│                       │                       │
         │<──────────────────────│                       │                       │
         │                       │                       │                       │
         │  {earnings,           │                       │                       │
         │   realized_pnl,       │                       │                       │
         │   position_debt_value}│                       │                       │
         ├──────────────────────>│                       │                       │
         │                       │                       │                       │
         │  Batch: user-history  │                       │                       │
         │<──────────────────────│                       │                       │
         │                       │                       │                       │
         │  {history_stats,      │                       │                       │
         │   realized_pnl_data}  │                       │                       │
         ├──────────────────────>│                       │                       │
         │                       │                       │                       │
         │                       │  Store (in-memory)    │                       │
         │                       ├──────────────────────>│                       │
         │                       │                       │                       │
         │                       │                       │  analyticsStore.      │
         │                       │                       │  earnings             │
         │                       │                       │<──────────────────────│
```

### Data Managed by useAnalyticsStore

| State | Source | Description |
|-------|--------|-------------|
| `dashboardData.earnings` | `/api/etl/batch/user-dashboard` | User earnings from leases |
| `dashboardData.realizedPnl` | `/api/etl/batch/user-dashboard` | User realized PnL total |
| `dashboardData.positionDebtValue` | `/api/etl/batch/user-dashboard` | Position/debt over time |
| `historyData.historyStats` | `/api/etl/batch/user-history` | PnL, volume, win rate stats |
| `historyData.realizedPnlData` | `/api/etl/batch/user-history` | Detailed PnL breakdown |
| `pnlOverTime` | `/api/etl/pnl-over-time` | PnL chart data (raw: `[{amount, date}, ...]`) |
| `priceSeriesCache` | `/api/etl/prices` | Price series for charts (raw: `[[timestamp, price], ...]`) |

### Lifecycle

- **Initialized**: When wallet connects via `useConnectionStore.connectWallet()`. The `initialized` flag is set to `true` only **after** both `fetchDashboardData()` and `fetchHistoryData()` complete — not before. This ensures components that check `analyticsStore.initialized` don't render with empty data.
- **Cleared**: When wallet disconnects via `useConnectionStore.disconnectWallet()`
- **In-memory only**: No localStorage caching (user-specific, cleared on disconnect)

### Component Usage

```typescript
// In dashboard/history/lease components
import { useAnalyticsStore } from "@/common/stores";

const analyticsStore = useAnalyticsStore();

// For dashboard
const earnings = computed(() => analyticsStore.earnings?.earnings);
const positionDebtValue = computed(() => analyticsStore.positionDebtValue);

// For history
const historyStats = computed(() => analyticsStore.historyStats);
const pnl = computed(() => analyticsStore.historyStats?.pnl?.toString() ?? "0");

// For charts
const pnlOverTime = computed(() => analyticsStore.pnlOverTime);

// Fetch price series (cached by key:protocol:interval)
const prices = await analyticsStore.fetchPriceSeries(key, protocol, interval);
```

### Migrated Components

The following components now use `useAnalyticsStore` instead of direct `EtlApi` calls:

| Component | Data Used |
|-----------|-----------|
| `DashboardRewards.vue` | `earnings` |
| `UnrealizedPnlChart.vue` | `positionDebtValue` |
| `RealisedPnl.vue` | `historyStats` |
| `PnlLog.vue` | `realizedPnl`, `fetchPnlList()` |
| `PriceOverTimeChart.vue` | `fetchPriceSeries()` |
| `PnlOverTimeChart.vue` | `fetchPnlOverTime(leaseAddress, interval)` |

### Chart Rendering

Position detail charts (`PriceOverTimeChart.vue`, `PnlOverTimeChart.vue`) and the stats page chart (`SupplyBorrowedChart.vue`) use Observable Plot with the following rendering optimizations:

- **Downsampling**: Data is reduced to ~200 points maximum before rendering for smoother performance
- **Curve interpolation**: `catmull-rom` curves with `strokeWidth: 2` and `strokeLinecap: "round"`
- **Y domain**: Computed from price data only, with liquidation included only if within 70% of the price range (prevents liquidation price from skewing the scale)
- **PnL address**: `fetchPnlOverTime()` takes a **lease contract address** (not wallet address) as the first parameter — the ETL `/pnl-over-time` endpoint expects the lease address

---

## 15. Transaction History Data Flow

The `/activities` page displays enriched transaction history. The backend fetches raw transactions from ETL, decodes protobuf message payloads, filters system transactions, detects swap vs transfer for IBC messages, and returns enriched data to the frontend.

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    ETL API      │     │  Rust Backend   │     │ useHistoryStore │     │  Vue Components │
│  (Transactions) │     │  (Enrichment)   │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │                       │
         │                       │  fetchTransactions()  │                       │
         │                       │<──────────────────────│                       │
         │                       │                       │                       │
         │  GET /api/txs?address │                       │                       │
         │<──────────────────────│                       │                       │
         │                       │                       │                       │
         │  Raw TxEntry[]        │                       │                       │
         │  (flat fields +       │                       │                       │
         │   base64 protobuf     │                       │                       │
         │   `value` field)      │                       │                       │
         ├──────────────────────>│                       │                       │
         │                       │                       │                       │
         │                       │  1. Filter by type    │                       │
         │                       │     (SUPPORTED_TX_    │                       │
         │                       │      TYPES allowlist) │                       │
         │                       │                       │                       │
         │                       │  2. Decode protobuf   │                       │
         │                       │     `value` → `data`  │                       │
         │                       │     (camelCase JSON)  │                       │
         │                       │                       │                       │
         │                       │  Enriched TxEntry[]   │                       │
         │                       ├──────────────────────>│                       │
         │                       │                       │                       │
         │                       │                       │  message(), action(), │
         │                       │                       │  icon() switch on     │
         │                       │                       │  msg.type + msg.data  │
         │                       │                       │<──────────────────────│
```

### Step 1: ETL Returns Raw Transactions

ETL returns a flat JSON array with a base64-encoded protobuf `value` field:

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
    "value": "Cixub2x1czF4eXoyM...",
    "timestamp": "2025-01-15T10:30:00Z"
  }
]
```

### Step 2: Backend Enrichment

**Source:** `backend/src/handlers/transactions.rs`

The handler performs three operations:

1. **Filter**: Only user-initiated transaction types pass through (`SUPPORTED_TX_TYPES` allowlist). System messages like `MsgUpdateClient`, `MsgAcknowledgement` are excluded.

2. **Decode**: Base64 `value` → protobuf bytes → structured `data` JSON with camelCase fields. Uses `cosmrs::proto` + `prost` for decoding.

3. **Swap Detection**: For IBC messages (`MsgTransfer`, `MsgRecvPacket`), the handler compares bech32 address data between the user and the counterparty. If the bech32 data parts (bytes between the `1` separator and the last 6 checksum chars) differ, it's a swap (via Skip/DEX); if they match, it's a direct transfer (same key, different chain). Sets `is_swap: true/false` on the enriched transaction.

4. **Preserve**: All original flat fields from ETL (`from`, `to`, `tx_hash`, `rewards`, `timestamp`, etc.) pass through unchanged.

```rust
// Filter system transactions
let enriched: Vec<serde_json::Value> = raw_txs
    .into_iter()
    .filter(|tx| is_user_transaction(tx))
    .map(enrich_transaction)
    .collect();
```

**Enriched Response:**
```json
[
  {
    "block": 12345,
    "from": "nolus1abc...",
    "to": "nolus1xyz...",
    "tx_hash": "ABC123...",
    "type": "/cosmos.bank.v1beta1.MsgSend",
    "timestamp": "2025-01-15T10:30:00Z",
    "data": {
      "fromAddress": "nolus1abc...",
      "toAddress": "nolus1xyz...",
      "amount": [{ "denom": "unls", "amount": "1000000" }]
    }
  }
]
```

### Step 3: Frontend Rendering

**Source:** `src/modules/history/common.ts`

The `message()`, `action()`, and `icon()` functions switch on `msg.type` (matched against the `Messages` enum) and read from `msg.data.*` to build display strings. For IBC messages, `msg.is_swap` determines whether to show "Swap" or "Transfer" labels:

```typescript
// For MsgExecuteContract, the msg field is a UTF-8 JSON string
const data = JSON.parse(Buffer.from(msg.data.msg).toString());
if (data.open_lease) { /* render open position */ }
if (data.deposit) { /* render earn deposit */ }
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/handlers/transactions.rs` | Protobuf decoding, filtering, enrichment |
| `src/common/stores/history/index.ts` | History store, pagination, fetch logic |
| `src/modules/history/common.ts` | `message()`, `action()`, `icon()` rendering |
| `src/modules/history/types/index.ts` | `Messages` enum, `Filter` enum |
| `src/common/api/types/etl.ts` | `TxEntry` TypeScript interface |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| ETL fetch failure | Hard fail (`AppError::ExternalApi`) |
| Single tx decode failure | Log warning, include tx without `data` field |
| Unknown message type | Log debug, include tx without `data` field |
| Frontend `message()` error | Falls through to display raw `msg.type` |

---

## Summary

Each data flow follows a consistent pattern:

1. **External Source** → Raw data from blockchain or APIs
2. **Backend Handler** → Transform, merge, enrich with configs
3. **Backend Cache** → Cache frequently accessed data
4. **REST/WebSocket** → Serialize and send to frontend
5. **API Client** → Transform to store-friendly format
6. **Pinia Store** → Manage state, computed values
7. **Vue Component** → Display to user

Configuration files control filtering, validation, and business rules at the backend layer, while the frontend focuses on presentation and user interaction.
