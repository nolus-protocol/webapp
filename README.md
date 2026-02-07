# Nolus Webapp

A DeFi money market web application for the [Nolus](https://nolus.io) protocol. Enables leveraged positions, earning via liquidity pools, staking, cross-chain swaps, and governance across multiple IBC-connected Cosmos networks.

## Architecture

```
Browser → Rust Backend (port 3000) → External APIs (ETL, Skip, Chain RPC)
              │
              ├── /api/*     REST endpoints (cached, rate-limited)
              ├── /api/etl/* ETL proxy endpoints
              ├── /ws        WebSocket (prices, leases, tx status)
              └── /*         Static files (Vue SPA)
```

The backend follows a **Backend-for-Frontend (BFF)** pattern — all external API calls, caching, rate limiting, and data enrichment happen server-side. The frontend communicates exclusively with the Rust backend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3.5, TypeScript 5.8, Pinia 3, Vite 7, Tailwind CSS, vue-i18n |
| Backend | Rust (Axum, Tokio, arc-swap, reqwest) |
| Blockchain | CosmJS, @nolus/nolusjs, cosmrs |
| Networks | Nolus, Osmosis, Neutron |
| Wallets | Keplr, Leap, Ledger (USB + Bluetooth), Phantom, Solflare |

## Requirements

- **Node.js** v20+
- **Rust** (stable toolchain)
- **npm**

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

Copy and edit the environment files as needed:

| File | Purpose |
|------|---------|
| `.env.spa` | Local dev (backend serves frontend) |
| `.env.serve` | Vite dev server mode (frontend only) |
| `backend/.env` | Backend configuration (API keys, URLs) |

### 3. Build and run

```sh
# Build frontend
npm run build -- --mode spa

# Build backend
cd backend && cargo build --release

# Start server
cd backend && nohup env STATIC_DIR=../dist ./target/release/nolus-backend > /tmp/nolus-backend.log 2>&1 &
```

The application will be available at `http://localhost:3000`.

### Development mode

Run the Vite dev server with hot-reload (requires the backend running separately):

```sh
npm run serve
```

## Project Structure

```
src/
├── common/
│   ├── api/              # BackendApi (REST), WebSocketClient (real-time)
│   ├── stores/           # Pinia stores (prices, config, balances, leases, earn, staking)
│   ├── composables/      # Vue composables
│   ├── components/       # Shared Vue components
│   └── utils/            # Utilities (LeaseUtils, CurrencyLookup, NumberFormatUtils)
├── modules/              # Feature modules (dashboard, leases, earn, stake, vote, stats)
└── push/                 # Service worker for push notifications

backend/
├── src/
│   ├── main.rs           # Server entry, all routes
│   ├── handlers/         # HTTP handlers by domain
│   ├── propagation/      # Gated propagation (filter, merge, validate)
│   ├── external/         # API clients (ETL, Skip, chain, referral)
│   ├── data_cache.rs     # Lock-free background-refresh cache
│   ├── refresh.rs        # Background refresh tasks
│   └── middleware/       # Rate limiting, auth, cache-control
└── config/
    ├── gated/            # Gated config (currency display, network config, lease rules)
    └── locales/          # Translation files (single source of truth)

public/                   # Static assets (copied to dist/ by Vite during build)
├── assets/icons/         # Currency, network, and pool icons
├── icons/                # PWA icons
└── manifest.json         # PWA manifest
```

## Commands

| Task | Command |
|------|---------|
| Build frontend | `npm run build -- --mode spa` |
| Build backend | `cd backend && cargo build --release` |
| Dev server (Vite) | `npm run serve` |
| Frontend tests | `npm test` |
| Backend tests | `cd backend && cargo test` |
| Format frontend | `npm run format` |
| Format backend | `cd backend && cargo fmt` |
| Lint backend | `cd backend && cargo clippy` |

## Documentation

Extended documentation is available in the `docs/` folder:

- **[API Reference](docs/api.md)** — REST endpoints, WebSocket protocol, error responses
- **[Data Flows](docs/data_flows.md)** — Data transforms through each layer
- **[Gated Propagation](docs/backend%20api%20enrichments%20and%20proxy.md)** — Admin config system and transaction enrichment
- **[Translations](docs/translations.md)** — Translation management with AI-powered generation
- **[Protocol Architecture](docs/protocol%20architecture.md)** — Protocol and contract architecture

See [CLAUDE.md](CLAUDE.md) for detailed development patterns and conventions.
