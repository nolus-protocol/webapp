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
3. **Backend handlers** (`backend/src/handlers/`) fetch from external APIs with caching (Moka)
4. **WebSocket** provides real-time updates for prices, balances, leases, and transaction status

### Key Patterns

- **Request coalescing**: BackendApi deduplicates simultaneous identical GET requests
- **Optimistic loading**: Stores use localStorage cache for instant UI, then fetch fresh data
- **Pinia stores**: Each domain (prices, leases, balances, etc.) has its own store with `initialize()` and `cleanup()` methods
- **configStore as source of truth**: Protocol configuration, position types, and gated data come from `configStore` (fetched from backend), not hardcoded frontend config

## Project Structure

```
src/
├── common/
│   ├── api/              # BackendApi (REST), WebSocketClient (real-time)
│   ├── stores/           # Pinia stores: prices, config, balances, leases, earn, staking, stats, analytics, etc.
│   ├── components/       # Shared Vue components
│   └── utils/            # Utilities (LeaseCalculator, PriceLookup, EtlApi, etc.)
├── modules/              # Feature modules (dashboard, leases, earn, stake, vote, etc.)
│   └── <module>/view.vue # Layout wrapper with <router-view />, children in components/
└── test/setup.ts         # Vitest setup (mocks fetch, WebSocket, Pinia)

backend/
├── src/
│   ├── main.rs           # Server entry, all routes defined here
│   ├── handlers/         # HTTP handlers by domain (leases, earn, staking, swap, etc.)
│   │   ├── gated_*.rs    # Gated propagation endpoints (assets, protocols, networks)
│   │   ├── gated_admin.rs # Admin CRUD for gated config
│   │   └── transactions.rs # Transaction enrichment (protobuf decode, filtering)
│   ├── propagation/      # Gated propagation module (filter, merge, validate)
│   ├── external/         # API clients (etl, skip, chain, referral, zero_interest)
│   ├── config_store/     # Config loading (gated_types.rs, storage.rs)
│   ├── cache.rs          # Moka cache wrapper
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
- **Optimistic loading**: Stores use localStorage cache for instant UI, then fetch fresh data
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
- **Swap routing**: Swaps use Skip API constrained to IBC-only bridges (`bridges: ["IBC"]`) and filtered to the user's selected network's venue. Config uses tickers in `swap-settings.json` (resolved to IBC denoms at runtime via ETL). Swap venues are defined per-network in `network-config.json`. Cosmos transfers are built dynamically from ETL `bank_symbol`/`dex_symbol`. See `backend/src/handlers/config.rs:fetch_skip_route_config_internal()` and `src/modules/assets/components/SwapForm.vue`
- **Network-aware balance deduplication**: `filteredBalances` in `src/common/stores/balances/index.ts` deduplicates currencies by ticker, preferring the IBC denom whose protocol belongs to the user's selected network (via `configStore.protocolFilter`)
- **Frontend PnL calculation**: `LeaseCalculator.calculatePnl()` computes PnL on the frontend from asset value, debt, and downpayment. The backend `lease.pnl` field is not used for display.
- **ETL chart data**: Price series (`/api/etl/prices`) returns raw `[[timestamp, price], ...]` arrays; PnL over time (`/api/etl/pnl-over-time`) returns raw `[{amount, date}, ...]` arrays. Both are proxied as-is (not wrapped in response objects). Note: `pnl-over-time` expects a **lease contract address**, not a wallet address.
- **Chart rendering**: Position charts and stats charts use Observable Plot with downsampling (~200 points max), `catmull-rom` curve interpolation, `strokeWidth: 2`. Price charts compute Y domain from price data only (liquidation price included only if within 70% of price range).
- **Wallet connection centralization**: All wallet connect/disconnect store coordination goes through `connectionStore.connectWallet(address)` and `connectionStore.disconnectWallet()`. Individual wallet connect actions (`connectKeplr.ts`, etc.) only set wallet state — they do NOT call store methods directly. Components do NOT have their own wallet watchers. Two entry points: `view.vue` (extension keystorechange events) and `entry-client.ts` (initial page load watcher with dedup guard). The `configStore.initialized` watcher in `view.vue` must use `{ immediate: true }` because optimistic caching means `initialized` may already be `true` at mount time.

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
- **Backend**: Rust (Axum, Tokio, Moka cache, reqwest)
- **Blockchain**: CosmJS, @nolus/nolusjs, cosmrs

## Design Principles

1. **No Fallbacks** - Fail fast, fix fast
2. **No Dead Code** - Remove unused code immediately
3. **No Backwards Compatibility Hacks** - Clean breaks, no aliases
4. **Hybrid Approach** - ETL and Oracle are first-class citizens by use case
5. **Historical Data Support** - ETL provides active + deprecated data

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
