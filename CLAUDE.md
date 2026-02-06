# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Build frontend | `npm run build -- --mode spa` |
| Build backend | `cd backend && cargo build --release` |
| Run server | `cd backend && STATIC_DIR=../dist ./target/release/nolus-backend` |
| Dev server (Vite) | `npm run serve` (requires backend running separately) |
| Frontend tests | `npm test` |
| Single test file | `npx vitest run src/path/to/file.test.ts` |
| Tests watch mode | `npm run test:watch` |
| Test coverage | `npm run test:coverage` |
| Backend tests | `cd backend && cargo test` |
| Single backend test | `cd backend && cargo test test_name` |
| Backend tests with output | `cd backend && cargo test -- --nocapture` |
| Format frontend | `npm run format` |
| Format backend | `cd backend && cargo fmt` |
| Lint backend | `cd backend && cargo clippy` |
| Type check backend | `cd backend && cargo check` |

## Architecture

```
Browser → Rust Backend (port 3000) → External APIs (ETL, Skip, Chain RPC)
              │
              ├── /api/*     REST endpoints (cached, rate-limited)
              ├── /api/etl/* ETL proxy endpoints
              ├── /ws        WebSocket (prices, leases, tx status)
              └── /*         Static files (Vue SPA)
```

### Data Flow

1. **Frontend stores** (`src/common/stores/`) call **BackendApi** (`src/common/api/BackendApi.ts`)
2. **BackendApi** makes HTTP requests to `/api/*` endpoints
3. **Backend handlers** (`backend/src/handlers/`) read from `AppDataCache` (lock-free `Cached<T>` values populated by background refresh tasks)
4. **WebSocket** provides real-time updates for prices, balances, leases, and transaction status

### Backend Cache Model

The backend uses a **background-refresh** architecture (`data_cache.rs` + `refresh.rs`):

- **`Cached<T>`** — lock-free cached value using `arc-swap`. One writer (background task), many readers (handlers). Methods: `load()`, `store()`, `age_secs()`.
- **`AppDataCache`** — single struct holding all `Cached<T>` fields (app_config, prices, currencies, pools, validators, etc.)
- **Background refresh tasks** (`refresh.rs` + `chain_events.rs`) — one `tokio::spawn` per data type. Chain-driven data (prices, leases, earn) refreshed via CometBFT WebSocket events; ETL/disk data refreshes on fixed intervals (30s-300s).
- **Handlers never fetch** — they read from cache via `data_cache.field.load()` and return 503 if cache isn't populated yet.
- **Warm-up on startup** — `warm_essential_data()` runs before the server accepts requests.
- **Admin config writes** trigger immediate refresh via `trigger_gated_refresh()` in `gated_admin.rs`.

### External API Clients

External API clients (`backend/src/external/`) share a single `reqwest::Client` connection pool configured with `pool_max_idle_per_host(32)`, `pool_idle_timeout(90s)`, `tcp_keepalive(60s)`. The shared client is created in `main.rs` and passed to all client constructors.

Clients implement the **`ExternalApiClient` trait** (`base_client.rs`) which provides standardized GET/POST/query methods with consistent error handling, bearer token auth, and URL building. Implementing clients: `ReferralClient`, `ZeroInterestClient`, `SkipClient`, `EtlClient`. `ChainClient` uses its own patterns (CosmWasm queries, LCD endpoints).

### Rate Limiting

Per-IP token bucket rate limiting via the `governor` crate:
- **Standard**: 20 req/s, burst 50 (read endpoints)
- **Strict**: 2 req/s, burst 5 (write endpoints)
- **Hot path**: Read lock + `Arc::clone` + `AtomicU64` timestamp update (no write lock for known IPs)
- **Eviction**: Background task every 5 minutes removes IPs inactive for 10+ minutes
- No rate limit response headers (pure 429 on exceed)

### Gated Propagation

Only admin-configured items are visible to users. ETL provides raw data; admin config files (`backend/config/gated/`) provide enrichment (icons, colors, display names). The propagation module (`backend/src/propagation/`) validates, filters, and merges these sources. See `docs/backend api enrichments and proxy.md` for details.

## Project Structure

```
src/
├── common/
│   ├── api/              # BackendApi (REST), WebSocketClient (real-time)
│   ├── stores/           # Pinia stores: prices, config, balances, leases, earn, staking, etc.
│   ├── composables/      # Vue composables (useNetworkCurrency, useValidation, useAsyncOperation)
│   ├── components/       # Shared Vue components
│   └── utils/            # Utilities (LeaseUtils, CurrencyLookup, PriceLookup, etc.)
├── modules/              # Feature modules (dashboard, leases, earn, stake, vote, etc.)
│   └── <module>/view.vue # Layout wrapper with <router-view />, children in components/
└── test/setup.ts         # Vitest setup (mocks fetch, WebSocket, Pinia)

backend/
├── src/
│   ├── main.rs           # Server entry, all routes defined here
│   ├── handlers/         # HTTP handlers by domain (leases, earn, staking, swap, etc.)
│   ├── propagation/      # Gated propagation module (filter, merge, validate)
│   ├── external/         # API clients (etl, skip, chain, referral, zero_interest, base_client)
│   ├── config_store/     # Config loading (gated_types.rs, storage.rs)
│   ├── chain_events.rs   # CometBFT WebSocket client, event parsing, broadcast channels
│   ├── data_cache.rs     # Cached<T>, AppDataCache (lock-free background-refresh cache)
│   ├── refresh.rs        # Background refresh tasks (timer-based + event-driven)
│   ├── etl_macros.rs     # Macro-generated ETL proxy handlers
│   └── middleware/       # Rate limiting (token bucket + eviction), auth, cache-control
└── config/
    ├── gated/            # Gated propagation config files (currency-display, network-config, etc.)
    └── locales/          # Translation files
```

## Environment Files

| File | Purpose |
|------|---------|
| `.env.spa` | Local dev (backend serves frontend) |
| `.env.serve` | Vite dev server mode (frontend only) |
| `backend/.env` | Backend configuration (API keys, URLs) |

### Required Environment Variables (backend/.env)

```bash
NOLUS_RPC_URL=https://rpc.nolus.network
NOLUS_REST_URL=https://lcd.nolus.network
ETL_API_URL=https://etl-internal.nolus.network
```

## Key Patterns

### configStore is the Source of Truth

Protocol configuration, position types, and gated data come from `configStore` (fetched from backend), not hardcoded frontend config. Key methods:
- `configStore.getPositionType(protocol)` — returns `"Long"` or `"Short"`
- `configStore.getActiveProtocolsForNetwork(network)` — returns active protocol names
- `configStore.getGatedProtocol(protocol)` — checks if protocol is active/configured
- `getLpnByProtocol(protocol)` — gets the LPN (stable) currency for a protocol
- `configStore.getCurrencyByTickerForNetwork(ticker, network)` — resolves ticker preferring the selected network
- `configStore.getCurrencyByKey(key)` — looks up by full `TICKER@PROTOCOL` key

### Network-Aware Currency Resolution

The same ticker (e.g., `USDC_NOBLE`) can exist on multiple networks with different IBC denoms. Resolution is centralized in two layers:

- **CurrencyLookup utility** (`src/common/utils/CurrencyLookup.ts`): `getCurrencyByTickerForProtocol(ticker, protocol)` for protocol-context; `getCurrencyByTickerForNetwork(ticker)` for network-context. **Never use `getCurrencyByTicker()` for cross-network currencies** — it returns the first match ignoring the selected network. Only safe for globally unique tickers like NLS.
- **`useNetworkCurrency` composable** (`src/common/composables/useNetworkCurrency.ts`): For Vue components needing enriched asset data (price, balance, earn status, APR). Entry points: `resolveForNetwork(ticker)`, `resolveForProtocol(ticker, protocol)`, `getNetworkAssets()`.

### Wallet Connection Centralization

All wallet connect/disconnect store coordination goes through `connectionStore.connectWallet(address)` and `connectionStore.disconnectWallet()`. Individual wallet connect actions only set wallet state — they do NOT call store methods directly. Components do NOT have their own wallet watchers. Two entry points: `view.vue` (extension keystorechange events) and `entry-client.ts` (initial page load watcher with dedup guard).

### Ref-Based Summary Pattern (Common Bug Source)

When aggregating store data into `ref` values (e.g., summary totals in `Leases.vue`), the watch MUST include `{ immediate: true }` and watch all dependencies (leases + prices). Without `immediate`, SPA navigation shows stale $0.00 because store data is already loaded at mount time. The `configStore.initialized` watcher in `view.vue` must also use `{ immediate: true }`.

### Frontend PnL Calculation

`LeaseCalculator.calculatePnl()` computes PnL on the frontend from asset value, debt, and downpayment. The backend `lease.pnl` field is not used for display.

### Lease In-Progress States

Opened leases have a `status` sub-field from the chain contract that maps to an `in_progress` field in the API response. The backend `parse_opened_status()` in `handlers/leases.rs` translates the chain format:

| Chain Value | Backend `LeaseInProgress` | Frontend `inProgressType` | UI Behavior |
|---|---|---|---|
| `"idle"` | `None` | `null` | Normal — all actions enabled |
| `"slippage_protection_activated"` | `SlippageProtection {}` | `"slippage_protection"` | MAG banner, all buttons disabled |
| `{"in_progress":{"repayment":..}}` | `Repayment {}` | `"repayment"` | Repaying banner, buttons disabled |
| `{"in_progress":{"close":..}}` | `Close {}` | `"close"` | Closing banner, buttons disabled |
| `{"in_progress":{"liquidation":..}}` | `Liquidation { cause }` | `"liquidation"` | Liquidation banner, buttons disabled |

**UI rules for in-progress states:**
- `SingleLeaseHeader.vue`: Repay/Close buttons shown but **disabled** (not hidden) via `openedSubState`
- `PositionSummaryWidget.vue`: Stop Loss/Take Profit buttons disabled via `loading` prop
- `SingleLease.vue`: `isInProgress` returns `true` for any non-opening type (shows loading skeletons on widgets)
- `Leases.vue`: Shows status text in title, Details button always visible, Action menu hidden

### Staking Post-Transaction Refresh

Staking forms (`DelegateForm`, `UndelegateForm`) call `stakingStore.fetchPositions()` + `balancesStore.fetchBalances()` directly after broadcasting, then close the dialog via `router.push(/stake)`. There are no provide/inject chains for data refresh or dialog closing — each form owns its own post-tx logic. `StakingRewards` and `RedelegateButton` follow the same pattern: call store methods directly, no injected callbacks.

**Note:** The backend has no cache for staking positions — `GET /api/staking/positions` queries the chain directly. There is also no WebSocket staking monitor task, so real-time push updates are not available for staking data.

### Other Patterns

- **Request coalescing**: BackendApi deduplicates simultaneous identical GET requests
- **Browser HTTP caching**: Global data uses backend `Cache-Control` headers. User-specific endpoints use `no-store`. No localStorage data caches — only user preferences persist in localStorage.
- **Pinia stores**: Each domain has its own store with `initialize()` and `cleanup()` methods
- **Price polling ownership**: Handled exclusively by `pricesStore.startPolling()`. `view.vue` only manages balance polling.
- **Network-aware balance deduplication**: `filteredBalances` in balances store deduplicates currencies by ticker, preferring the IBC denom whose protocol belongs to the user's selected network
- **Transaction enrichment**: `/api/etl/txs` decodes protobuf, filters system txs, adds `data` field, and detects swap vs transfer via `is_swap` (bech32 address comparison)
- **ETL proxy macros**: `etl_macros.rs` generates ETL proxy handlers via macros (`etl_proxy_raw!`, `etl_proxy_typed!`, etc.). Typed macros deserialize directly to the target type in a single pass.
- **ETL chart data**: `/api/etl/prices` returns raw `[[timestamp, price], ...]`; `/api/etl/pnl-over-time` returns raw `[{amount, date}, ...]`. Note: `pnl-over-time` expects a **lease contract address**, not a wallet address.

## Common Tasks

### Add API Endpoint

1. Create handler in `backend/src/handlers/<domain>.rs`
2. Add route in `backend/src/main.rs` (`create_router` function)
3. Add method in `src/common/api/BackendApi.ts`
4. Add types in `src/common/api/types/`

### API Endpoint Taxonomy

Domain-specific config lives next to its domain, not under a generic `/api/config/*` namespace:

| Domain | Endpoint | Handler |
|--------|----------|---------|
| Leases | `/api/leases/config/{protocol}` | `handlers::leases::get_lease_config` |
| Swap | `/api/swap/config` | `handlers::swap::get_swap_config` |
| Governance | `/api/governance/hidden-proposals` | `handlers::governance::get_hidden_proposals` |
| Locales | `/api/locales/{lang}` | `handlers::locales::get_locale` |
| App config | `/api/config` | `handlers::config::get_config` |

### Add Pinia Store

1. Create `src/common/stores/<name>/index.ts` with `defineStore()`
2. Export from `src/common/stores/index.ts`
3. Include `initialize()` and `cleanup()` methods for lifecycle management

### Add Frontend Module

1. Create `src/modules/<name>/view.vue`
2. Add route in `src/router/index.ts`

## URL Routing

Routes are defined in `src/router/RouteNames.ts` as an enum. The enum values are the URL path segments:

| Route | URL | Module |
|-------|-----|--------|
| `DASHBOARD` | `/` | Dashboard |
| `LEASES` | `/positions` | Positions (margin trading) |
| `ASSETS` | `/assets` | Assets |
| `EARN` | `/earn` | Earn |
| `STAKE` | `/stake` | Stake |
| `HISTORY` | `/activities` | Activities (tx history + PnL log) |
| `VOTE` | `/vote` | Governance |
| `STATS` | `/stats` | Statistics |

Key sub-routes: `/positions/open/long`, `/positions/open/short`, `/positions/:id`, `/activities/pnl-log`

## Tech Stack

- **Frontend**: Vue 3.5, TypeScript 5.8, Pinia 3, Vite 7, Tailwind CSS, vue-i18n
- **Backend**: Rust (Axum, Tokio, arc-swap, reqwest)
- **Blockchain**: CosmJS, @nolus/nolusjs, cosmrs
- **Supported Networks**: Nolus, Osmosis, Neutron
- **Supported Wallets**: Keplr, Leap, Ledger (USB + Bluetooth), Phantom (EVM), Solflare (Solana)

## Design Principles

1. **No Fallbacks** - Fail fast, fix fast
2. **No Dead Code** - Remove unused code immediately
3. **No Backwards Compatibility Hacks** - Clean breaks, no aliases
4. **Hybrid Refresh** - Chain events for chain data, timers for ETL/disk data

## Code Quality Rules

- **Delete, don't deprecate** - Remove unused code, don't comment it out
- **No fallback patterns** - If something fails, let it fail visibly
- **No wrapper compatibility** - Don't wrap old APIs to look like new ones
- **No optional fields for migration** - Required fields are required
- **Fail loudly** - Errors should be obvious, not silently swallowed

## Code Style

- **Frontend**: Use Composition API with `<script setup>`, prefer `ref`/`computed` over `reactive`
- **Backend**: Use `tracing` for logging, handle errors with `Result<T, AppError>`
- **Stores**: Follow setup syntax pattern with state, computed, and actions sections

## Documentation

Extended documentation is available in the `docs/` folder:
- `api.md` - REST endpoints, WebSocket protocol, error responses
- `data_flows.md` - Data transforms through each layer (wallet connection, transaction enrichment, chart rendering, analytics)
- `backend api enrichments and proxy.md` - Gated propagation system + transaction enrichment details
- `translations.md` - Translation management system
- `protocol architecture.md` - Protocol and contract architecture
