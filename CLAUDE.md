# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Build frontend | `npm run build -- --mode spa` |
| Build backend | `cd backend && cargo build --release` |
| Run server | `cd backend && nohup env STATIC_DIR=../dist ./target/release/nolus-backend > /tmp/nolus-backend.log 2>&1 &` — must use `nohup` or the process dies when the shell session ends, producing `ERR_EMPTY_RESPONSE` on all API calls. Logs go to `/tmp/nolus-backend.log`. |
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
- **Background refresh tasks** (`refresh.rs` + `chain_events.rs`) — 6 dependency-aware task groups (not individual tasks per data type). Chain-driven data (prices, gas fees) refreshed via CometBFT WebSocket events; ETL/gated data refreshes in a sequential pipeline (core → derived) on 60s timers; slow data (swap config) on 300s timer.
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
│   ├── composables/      # Vue composables (useWalletEvents, useNetworkCurrency, useValidation, useAsyncOperation, useBlockInfo)
│   ├── components/       # Shared Vue components
│   └── utils/            # Utilities (LeaseUtils, CurrencyLookup, PriceLookup, etc.)
├── modules/              # Feature modules (dashboard, leases, earn, stake, vote, etc.)
│   └── <module>/view.vue # Layout wrapper with <router-view />, children in components/
└── test/setup.ts         # Vitest setup (mocks fetch, WebSocket, Pinia)

backend/
├── src/
│   ├── main.rs           # Server entry, all routes defined here
│   ├── handlers/         # HTTP handlers by domain (leases, earn, staking, swap, fees, etc.)
│   ├── propagation/      # Gated propagation module (filter, merge, validate)
│   ├── external/         # API clients (etl, skip, chain, referral, zero_interest, base_client)
│   ├── config_store/     # Config loading (gated_types.rs, storage.rs)
│   ├── chain_events.rs   # CometBFT WebSocket client, event parsing, broadcast channels
│   ├── data_cache.rs     # Cached<T>, AppDataCache (lock-free background-refresh cache)
│   ├── refresh.rs        # Background refresh tasks (timer-based + event-driven)
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

### Gas Fee BFF Pattern

Gas prices and gas multiplier are served from the backend (`/api/fees/gas-config`) instead of the browser querying the chain's tax module directly. `NolusWalletOverride.ts` patches `gasPrices()`, `simulateTx()`, `simulateMultiTx()`, and `getGasInfo()` on each NolusWallet instance to use the backend-cached data. The gas multiplier is configured per network in `backend/config/gated/network-config.json` (NOLUS: 3.5, OSMOSIS: 3.5, NEUTRON: 2.5). All wallet connect actions (`connectKeplr`, `connectLeap`, `connectLedger`, `connectPhantom`, `connectSolflare`) call `applyNolusWalletOverrides(wallet)` after creating the wallet.

### Wallet Connection Architecture

Keplr and Leap share identical connection patterns. Shared logic is extracted into:
- `connectKeplrLike.ts` — shared connect action; `connectKeplr.ts`/`connectLeap.ts` are thin wrappers
- `WalletFactory.authenticateKeplrLike()` — shared external wallet authentication; `authenticateKeplr`/`authenticateLeap` are one-liners
- `WalletUtils.getExtension("keplr" | "leap")` — shared extension getter

`WalletConnect.ts` uses `Record<WalletConnectMechanism, ...>` maps for dispatching instead of switch statements. Adding/removing a wallet type is a one-line change.

### Wallet Connection Centralization

`connectionStore.connectWallet(address)` sets `walletAddress` — user-specific stores (balances, leases, staking, earn, analytics, history) self-register by watching `connectionStore.walletAddress` with `{ immediate: true }`. Stores load their own data when the address appears and cleanup when it clears. `connectionStore` does NOT import or call user-specific stores. Side effects (keystorechange listeners, initial wallet connect) live in the `useWalletEvents` composable (`src/common/composables/useWalletEvents.ts`), called once from `view.vue`. Two entry points trigger `connectWallet`: `useWalletEvents` (extension keystorechange events) and `entry-client.ts` (initial page load watcher with dedup guard).

### Wallet-Aware Empty States

Components that show different content based on wallet connection use the `useWalletConnected()` composable (`src/common/composables/useWalletConnected.ts`) — a single `computed(() => !!wallet.wallet)`. **Do not** pass wallet state as props (`isVisible`, `showEmpty`), and **do not** check `wallet.wallet` directly in templates for visibility logic. Each widget calls the composable directly.

Dashboard widgets (`DashboardAssets`, `DashboardLeases`, `DashboardRewards`) and the stake page use this to distinguish two empty state reasons:
1. **No wallet connected** — show EmptyState without action buttons
2. **Wallet connected but no data** — show EmptyState with action buttons (Receive, Open Position, Delegate, etc.)

The `EmptyState` component itself stays dumb/presentational — it receives slider content via props and has no wallet awareness. The calling component decides what to show based on `walletConnected` and data state.

### Ref-Based Summary Pattern (Common Bug Source)

When aggregating store data into `ref` values (e.g., summary totals in `Leases.vue`), the watch MUST include `{ immediate: true }` and watch all dependencies (leases + prices). Without `immediate`, SPA navigation shows stale $0.00 because store data is already loaded at mount time. The `configStore.initialized` watcher in `view.vue` must also use `{ immediate: true }`.

### PnL Calculation

PnL is computed in **both** the backend and the frontend using the same formula: `pnlAmount = assetValueUsd - totalDebtUsd - downPayment + fee - repaymentValue`. The backend calculates PnL in `build_opened_lease_info()` (`handlers/leases.rs`) using prices and currencies from the data cache, and returns `pnl.amount`, `pnl.percent`, `pnl.pnl_positive` in the API response. The frontend's `LeaseCalculator.calculatePnl()` recomputes PnL for display using live store data (prices may be more current than the cached API response). The `pnl.amount` from the API is used by `LeaseCalculator.calculateTotalPnl()` for summary totals.

**PnL arrow direction:** All PnL displays use `pnlPositive` (from `LeaseCalculator`) as the single source of truth for arrow direction and color. `BigNumber.vue` renders the arrow directly (SvgIcon + CSS classes) based on `pnlStatus.positive`, bypassing the `Badge` component's independent `Number(content)` parsing which can disagree for near-zero values like `-0.00%`. The `SingleLeaseHeader.vue` uses the same `pnl.status` boolean for its inline arrow rendering.

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

### Staking Validator Format

The backend returns validators in a **flat format** (`commission_rate`, `max_commission_rate`, `max_commission_change_rate`, `moniker`, `details`). Staking components (`DelegateForm`, `RedelegateButton`) expect the **nested Cosmos LCD format** (`commission.commission_rates.rate`, `description.moniker`). The shared `transformValidator()` helper in `NetworkUtils.ts` bridges the two formats. All three validator loaders — `loadValidators()`, `loadDelegatorValidators()`, `loadValidator()` — apply this transform. The `ValidatorInfo` type in `src/common/api/types/staking.ts` matches the flat backend format; the nested format is untyped (used via `any` in sort callbacks).

### Staking Post-Transaction Refresh

Staking forms (`DelegateForm`, `UndelegateForm`) call `stakingStore.fetchPositions()` + `balancesStore.fetchBalances()` directly after broadcasting, then close the dialog via `router.push(/stake)`. There are no provide/inject chains for data refresh or dialog closing — each form owns its own post-tx logic. `StakingRewards` and `RedelegateButton` follow the same pattern: call store methods directly, no injected callbacks.

**Note:** The backend has no cache for staking positions — `GET /api/staking/positions` queries the chain directly. There is also no WebSocket staking monitor task, so real-time push updates are not available for staking data.

### Centralized Number Formatting

All `Intl.NumberFormat` calls live in `src/common/utils/NumberFormatUtils.ts` and `src/common/utils/ChartUtils.ts` (chart axis ticks only). No other file should use `new Intl.NumberFormat()` directly. Key exports:

- `formatNumber(amount, decimals, symbol?)` — standard locale-aware formatting
- `formatUsd(amount)` — shorthand for `formatNumber(amount, 2, "$")`
- `formatDecAsUsd(dec)` — format a `Dec` as USD in one call (replaces the `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(2), 2)}` boilerplate)
- `formatCompact(amount)` — compact notation (1K, 1M, etc.)
- `formatTokenBalance(dec)` — adaptive decimals based on amount size, trailing zeros trimmed
- `formatPrice(amount, decimals?)` — format a price with adaptive decimals (2-6 based on magnitude)
- `formatPriceDec(dec)` — format a `Dec` as a price string with adaptive decimals
- `formatPriceUsd(amount)` — format a price with adaptive decimals and `$` prefix (handles negative sign)
- `formatPriceDecUsd(dec)` — `Dec` variant of `formatPriceUsd`
- `formatCoinPretty(coin)` — format a `CoinPretty` as `"1,234.56 USDC"` (replaces `coin.toString()` which uses no locale formatting)
- `getAdaptivePriceDecimals(price)` — returns 2-6 decimals based on price magnitude (used by chart tooltips, lease details)
- `currencyFormatOptions(decimals)` / `compactFormatOptions` — `Intl.NumberFormatOptions` objects for `AnimateNumber` `:format` prop (keeps animated and static formatting in sync)
- `tokenFormatOptions(maxDecimals)` — format option object for AnimateNumber in TOKEN contexts

Amount display is split into two components: `TokenAmount.vue` (receives raw on-chain micro-units via `microAmount`, converts with `Dec(amount, decimals)`, formats with adaptive precision) and `FormattedAmount.vue` (receives human-readable numbers via `value`, formats with fixed decimals). `BigNumber.vue` uses a discriminated union (`AmountDisplayProps`) with `isTokenAmount()` type guard to render the correct child. `AnimateNumber` receives shared format option objects rather than inline literals.

Mobile-specific formatters for compact display on small screens:
- `formatMobileAmount(dec)` — compact notation for values >= 1000 (e.g., "1.2K", "3.5M"), falls back to `formatTokenBalance` for smaller values to preserve precision (e.g., "0.000034")
- `formatMobileUsd(dec)` — compact notation for USD values >= 1000 with `$` prefix (e.g., `"$1.50K"`), falls back to `formatUsd()` for smaller values

### Chart Configuration

All charts use Observable Plot (`@observablehq/plot`) with shared configuration from `src/common/utils/ChartUtils.ts`. Key exports:

- `CHART_AXIS` — shared axis config (tick counts, font size, mobile-aware)
- `getChartWidth(plotContainer)` — measures container via `parentElement.clientWidth`
- `computeMarginLeft(yDomain, tickFormat, ticks)` — dynamic left margin via Canvas 2D `measureText`
- `createUsdTickFormat(yDomain)` — factory: returns a tick formatter based on data range (compact `$1.5K`/`$2M` for >=1K, 2-decimal `$7.00` for >=1, adaptive for sub-dollar)
- `createNumberTickFormat(yDomain)` — same logic without `$` prefix (for token amount charts)

Chart.vue uses a `ResizeObserver` to re-render charts when the container resizes. Charts fill their container width — no hardcoded widths.

### Mobile Layout Patterns

The app runs in wallet built-in browsers (Keplr, Leap) at ~360px viewport width. Mobile detection uses `isMobile()` (non-reactive, acceptable since wallet browsers don't resize).

**BigNumber font sizes**: All `BigNumber` components use `isMobile() ? 24 : 32` for primary amounts and `20` for secondary amounts. This ensures summary numbers are visually larger than table text.

**ListHeader**: Left-aligned title on mobile, full-width buttons via `[&>*]:flex-1 md:[&>*]:flex-initial`. Buttons in slots should not be wrapped in extra `<div>` elements — use `v-if` directly on each button.

**Table mobile formatting**: Tables use `formatMobileAmount`/`formatMobileUsd` for numeric cells on mobile to prevent overflow with large numbers. Column headers and cells must use matching flex classes for vertical alignment.

**Popover mobile behavior**: The `web-components` Popover renders full-screen on mobile (`window.innerWidth < 768`) for large modals (Settings, Account). Small dropdown menus (e.g., Action 3-dot menu) opt out by adding the `popover-dropdown` CSS class plus `!h-fit !w-auto !rounded-xl !border !border-border-default` overrides. The Popover JS checks for `popover-dropdown` to skip the mobile full-screen positioning. **Note**: The compiled Popover at `node_modules/web-components/dist/src/components/molecules/popover/Popover.vue.js` is what Vite uses — not the raw `.vue` source files.

**SingleLeaseHeader mobile layout**: On mobile, PnL badge moves to the right of the title row (same line as `#address`), buttons span full width via `[&>*]:flex-1 lg:[&>*]:flex-initial`, and the inline PnL/Opened/Size info line is hidden (uses `lg:flex`).

### Gated Asset Restrictions

`lease-rules.json` controls which assets are visible via `ignore_all`, `ignore_long`, `ignore_short` lists. **These restrictions apply to existing leases too**, not just new position creation. Adding an asset to `ignore_long` hides all existing long positions with that asset from the dashboard and positions page. See `docs/data_flows.md` for details.

### Other Patterns

- **Request coalescing**: BackendApi deduplicates simultaneous identical GET requests
- **Browser HTTP caching**: Global data uses backend `Cache-Control` headers. User-specific endpoints use `no-store`. No localStorage data caches — only user preferences persist in localStorage.
- **Pinia stores**: Each domain has its own store with `initialize()` and `cleanup()` methods. User-specific stores self-register via `watch(() => connectionStore.walletAddress, ..., { immediate: true })`.
- **Real-time prices**: Prices are fetched once via REST on startup, then kept current via WebSocket subscription (~6s cadence from backend CometBFT events). No frontend polling.
- **Network-aware balance deduplication**: `filteredBalances` in balances store deduplicates currencies by ticker, preferring the IBC denom whose protocol belongs to the user's selected network
- **Post-transaction balance refresh**: Lease dialogs (close, repay) refresh balances via `balancesStore.fetchBalances()` in the `reload()` callback. The backend does not push balance updates via WebSocket — refresh is explicit after transactions.
- **Transaction enrichment**: `/api/etl/txs` decodes protobuf, filters system txs, adds `data` field, and detects swap vs transfer via `is_swap` (bech32 address comparison). Decoded transactions are cached in an LRU cache (500 entries, 300s TTL) to avoid repeated protobuf decoding.
- **Generic ETL proxy**: `etl_proxy.rs` uses a single generic handler with a `HashSet` allowlist of ~24 paths. Specialized handlers are kept for enriched endpoints (`/txs`), POST endpoints (`/subscribe`), and batch endpoints. No macros.
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
| Fees | `/api/fees/gas-config` | `handlers::fees::get_gas_fee_config` |
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
5. **Single Source of Truth** - Arrow/icon direction in PnL displays is driven by `pnlStatus.positive` boolean, never by re-parsing formatted strings

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
