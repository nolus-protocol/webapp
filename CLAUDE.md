# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install dependencies and build
npm install
cd backend && cargo build --release && cd ..
npm run build -- --mode spa

# Run (single server serves both frontend and API on port 3000)
cd backend && STATIC_DIR=../dist ./target/release/nolus-backend
```

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
- **`AppDataCache`** — single struct holding all 15 `Cached<T>` fields (app_config, prices, currencies, pools, validators, etc.)
- **Background refresh tasks** (`refresh.rs` + `chain_events.rs`) — one `tokio::spawn` per data type. Chain-driven data (prices, leases, earn) is refreshed via CometBFT WebSocket events (`NewBlock`, `Tx`); ETL/disk data refreshes on fixed intervals (30s–300s). All external fetching happens here.
- **Handlers never fetch** — they read from cache via `data_cache.field.load()` and return 503 (`ServiceUnavailable`) if the cache isn't populated yet.
- **Chain query semaphore** — `ChainClient` limits concurrent LCD requests (max 12) to prevent burst overload on cold start.
- **Warm-up on startup** — `warm_essential_data()` runs before the server accepts requests, populating critical caches (gated config → filter context → protocol contracts → currencies → prices).
- **Admin config writes** trigger immediate refresh of affected caches via `trigger_gated_refresh()` in `gated_admin.rs`.

### Key Patterns

- **Request coalescing**: BackendApi deduplicates simultaneous identical GET requests
- **Browser HTTP caching**: Global data (prices, config, currencies) uses backend `Cache-Control` headers for browser caching. User-specific endpoints (balances, leases, staking/earn positions, referrals, swap status, zero-interest) use `no-store` — never browser-cached. No localStorage data caches — only user preferences (`protocol_filter`, `selected_network`) persist in localStorage.
- **Pinia stores**: Each domain (prices, leases, balances, etc.) has its own store with `initialize()` and `cleanup()` methods
- **configStore as source of truth**: Protocol configuration, position types, and gated data come from `configStore` (fetched from backend), not hardcoded frontend config

## Project Structure

```
src/
├── common/
│   ├── api/              # BackendApi (REST), WebSocketClient (real-time)
│   ├── stores/           # Pinia stores: prices, config, balances, leases, earn, staking, stats, analytics, etc.
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
│   │   ├── gated_*.rs    # Gated propagation endpoints (assets, protocols, networks)
│   │   ├── gated_admin.rs # Admin CRUD for gated config
│   │   ├── locales.rs    # Translation locale serving
│   │   └── transactions.rs # Transaction enrichment (protobuf decode, filtering)
│   ├── propagation/      # Gated propagation module (filter, merge, validate)
│   ├── external/         # API clients (etl, skip, chain, referral, zero_interest)
│   ├── config_store/     # Config loading (gated_types.rs, storage.rs)
│   ├── chain_events.rs   # CometBFT WebSocket client, event parsing, broadcast channels
│   ├── data_cache.rs     # Cached<T>, AppDataCache (lock-free background-refresh cache)
│   ├── refresh.rs        # Background refresh tasks (timer-based + event-driven)
│   └── middleware.rs     # Rate limiting, auth, cache-control
└── config/
    ├── gated/            # Gated propagation config files
    │   ├── currency-display.json
    │   ├── network-config.json
    │   ├── lease-rules.json
    │   ├── swap-settings.json
    │   └── ui-settings.json
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
# Nolus chain endpoints (required - all contracts are on Nolus)
NOLUS_RPC_URL=https://rpc.nolus.network
NOLUS_REST_URL=https://lcd.nolus.network

# ETL API (required)
ETL_API_URL=https://etl-internal.nolus.network
```

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

## Testing

Frontend tests use Vitest with jsdom. Test files are co-located with source (`*.test.ts`).

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run src/common/composables/useValidation.test.ts

# Watch mode
npm run test:watch
```

Backend tests use Rust's built-in test framework with `wiremock` for mocking HTTP.

```bash
cd backend
cargo test                    # All tests
cargo test handler_           # Tests matching pattern
cargo test -- --nocapture     # Show println! output
```

## Key Patterns

- **Request coalescing**: BackendApi deduplicates simultaneous identical GET requests
- **Browser HTTP caching**: Global data uses backend `Cache-Control` headers. User-specific endpoints use `no-store`. Only user preferences persist in localStorage.
- **Pinia stores**: Each domain has its own store with `initialize()` and `cleanup()` methods
- **WebSocket subscriptions**: Real-time updates for prices, balances, leases, staking, tx_status
- **Transaction enrichment**: `/api/etl/txs` is a custom handler (not raw proxy) that decodes protobuf, filters system txs, adds `data` field, and detects swap vs transfer for IBC messages via `is_swap` field (bech32 address comparison). See `backend/src/handlers/transactions.rs`
- **Dynamic protocol config**: Use `configStore` methods for protocol/position type lookups:
  - `configStore.getPositionType(protocol)` - returns `"Long"` or `"Short"`
  - `configStore.getActiveProtocolsForNetwork(network)` - returns active protocol names
  - `configStore.getGatedProtocol(protocol)` - checks if protocol is active/configured
  - `configStore.isProtocolFilterDisabled(network)` - checks if network has no active protocols
  - `configStore.ensureDefaultProtocolFilter()` - sets default protocol filter when current one is invalid
  - `configStore.getNetworkFilterOptions()` - returns network options for filter dropdowns
  - `configStore.assetIcons` - maps tickers to icon URLs from gated config
  - `getLpnByProtocol(protocol)` - gets the LPN (stable) currency for a protocol
  - `configStore.getCurrencyByTickerForNetwork(ticker, network)` - resolves ticker preferring the selected network's protocols
  - `configStore.getCurrencyByKey(key)` - looks up by full `TICKER@PROTOCOL` key
- **Network-aware currency resolution**: The same ticker (e.g., `USDC_NOBLE`) can exist on multiple networks with different IBC denoms. Currency resolution is centralized in two layers:
  - **CurrencyLookup utility** (`src/common/utils/CurrencyLookup.ts`): `getCurrencyByTickerForProtocol(ticker, protocol)` for protocol-context (leases, earn, history), `getCurrencyByTickerForNetwork(ticker)` for network-context (assets, dashboard, receive). **Never use `getCurrencyByTicker()` for cross-network currencies** — it returns the first match ignoring the selected network. Only safe for globally unique tickers like NLS.
  - **`useNetworkCurrency` composable** (`src/common/composables/useNetworkCurrency.ts`): For Vue components needing enriched asset data. Returns `ResolvedAsset` with currency, price, balance, earn status, APR. Entry points: `resolveForNetwork(ticker)`, `resolveForProtocol(ticker, protocol)`, `getNetworkAssets()`. Used by `AssetsTable.vue` and `DashboardAssets.vue`.
- **Swap routing**: Swaps use Skip API constrained to IBC-only bridges (`bridges: ["IBC"]`) and filtered to the user's selected network's venue. Only Cosmos wallets are supported for swaps (no EVM/CCTP paths). Config uses tickers in `swap-settings.json` (resolved to IBC denoms at runtime via ETL). Swap venues are defined per-network in `network-config.json` (Osmosis, Neutron). Cosmos transfers are built dynamically from ETL `bank_symbol`/`dex_symbol`. See `backend/src/refresh.rs:refresh_swap_config()` and `src/modules/assets/components/SwapForm.vue`
- **Network-aware balance deduplication**: `filteredBalances` in `src/common/stores/balances/index.ts` deduplicates currencies by ticker, preferring the IBC denom whose protocol belongs to the user's selected network (via `configStore.protocolFilter`)
- **Frontend PnL calculation**: `LeaseCalculator.calculatePnl()` computes PnL on the frontend from asset value, debt, and downpayment. The backend `lease.pnl` field is not used for display.
- **ETL chart data**: Price series (`/api/etl/prices`) returns raw `[[timestamp, price], ...]` arrays; PnL over time (`/api/etl/pnl-over-time`) returns raw `[{amount, date}, ...]` arrays. Both are proxied as-is (not wrapped in response objects). Note: `pnl-over-time` expects a **lease contract address**, not a wallet address.
- **Chart rendering**: Position charts and stats charts use Observable Plot with downsampling (~200 points max), `catmull-rom` curve interpolation, `strokeWidth: 2`. Price charts compute Y domain from price data only (liquidation price included only if within 70% of price range).
- **Wallet connection centralization**: All wallet connect/disconnect store coordination goes through `connectionStore.connectWallet(address)` and `connectionStore.disconnectWallet()`. Individual wallet connect actions (`connectKeplr.ts`, etc.) only set wallet state — they do NOT call store methods directly. Components do NOT have their own wallet watchers (no `stakingStore.setAddress()` or `fetchPositions()` in components). `Disconnect.vue` calls both `wallet.DISCONNECT()` and `connectionStore.disconnectWallet()`. Two entry points: `view.vue` (extension keystorechange events) and `entry-client.ts` (initial page load watcher with dedup guard). The `configStore.initialized` watcher in `view.vue` must use `{ immediate: true }` because `initialized` may already be `true` at mount time. Supported wallets: Keplr, Leap, Ledger (USB + Bluetooth), Phantom (EVM), Solflare (Solana). MetaMask and WalletConnect were removed.
- **Price polling ownership**: Price polling is handled exclusively by `pricesStore.startPolling()` (called during `pricesStore.initialize()`). `view.vue` does NOT have its own price polling — it only manages balance polling via `startBalancePolling()`.
- **Ref-based summary pattern**: When aggregating store data into `ref` values (e.g., summary totals in `Leases.vue`), the watch MUST include `{ immediate: true }` and watch all dependencies (leases + prices). Without `immediate`, SPA navigation shows stale $0.00 because store data is already loaded at mount time. See `Leases.vue` and `AssetsTable.vue` for the correct pattern.
- **CometBFT event-driven refresh**: Chain data (prices, leases, earn) is refreshed via CometBFT WebSocket subscriptions (`chain_events.rs`) instead of fixed-interval timers. `NewBlock` events trigger price refreshes (~6s, every other block). `Tx` wasm events trigger lease monitoring (500ms debounce) and earn monitoring (10s debounce). WS URL is derived from `NOLUS_RPC_URL` + `/websocket` (no extra env var). On disconnect, exponential backoff reconnection (1s→30s). ETL/disk data (config, pools, validators, stats) stays on timers. Skip transaction tracking (`start_skip_tracking_task`) stays on a 5s timer (external API, no chain events).

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

Key sub-routes:
- `/positions/open/long` and `/positions/open/short` — New position forms
- `/positions/:id` — Single position detail (protocol comes from lease API data, not URL)
- `/activities/pnl-log` — PnL breakdown log

Navigation menus (`DesktopMenu.vue`, `MobileMenu.vue`) generate links from the enum and use an `iconMap` to decouple icon names from route paths (icons are `leases.svg`/`history.svg` in `web-components`).

## Tech Stack

- **Frontend**: Vue 3.5, TypeScript 5.8, Pinia 3, Vite 7, Tailwind CSS, vue-i18n
- **Backend**: Rust (Axum, Tokio, arc-swap, reqwest)
- **Blockchain**: CosmJS, @nolus/nolusjs, cosmrs
- **Supported Networks**: Nolus, Osmosis, Neutron (configured via `src/networks/config.ts` and `src/config/global/networks.ts`)
- **Supported Wallets**: Keplr, Leap, Ledger (USB + Bluetooth), Phantom (EVM via MetaMaskWallet class), Solflare (Solana)

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
- `data_flows.md` - How data transforms through each layer (wallet connection flow, transaction enrichment, chart rendering, analytics)
- `backend api enrichments and proxy.md` - Gated propagation system + transaction enrichment details
- `translations.md` - Translation management system
- `protocol architecture.md` - Protocol and contract architecture

## Network & Wallet Architecture

### Supported Networks (3)
Only Nolus, Osmosis, and Neutron are configured. Network definitions live in `src/networks/list/{nolus,osmosis,neutron}/` with static `embedChainInfo` functions that provide Keplr/Leap wallet extension data (bech32 config, currencies, features). The backend provides runtime data (RPC, LCD, gas, chains) via `network-config.json`.

### Network Config
- `src/networks/config.ts` — `CHAIN_INFO_EMBEDDERS` map (3 entries: NOLUS, OSMOSIS, NEUTRON)
- `src/config/global/networks.ts` — `SUPPORTED_NETWORKS` array
- `src/networks/cosm/` — Cosmos wallet infrastructure (BaseWallet, WalletFactory, accountParser)
- `src/networks/evm/` — EVM wallet class (used by Phantom)
- `src/networks/sol/` — Solana wallet class (used by Solflare)
- `src/networks/metamask/` — MetaMaskWallet class (reused by Phantom's EVM connection)

### Wallet Connection Actions
Each wallet type has a connect action in `src/common/stores/wallet/actions/`:
- `connectKeplr.ts`, `connectLeap.ts`, `connectLedger.ts` — Cosmos wallets
- `connectPhantom.ts` — Uses `MetaMaskWallet` class from `src/networks/metamask/`
- `connectSolFlare.ts` — Uses Solana wallet from `src/networks/sol/`
