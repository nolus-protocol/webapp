# Nolus Webapp

A DeFi money market web application for the [Nolus](https://nolus.io) protocol. Enables leveraged positions, earning via liquidity pools, staking, cross-chain swaps, and governance across multiple IBC-connected networks.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Pinia, Vite, Tailwind CSS, vue-i18n |
| Backend | Rust (Axum, Tokio) |
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
| `backend/.env` | Backend configuration (see `backend/.env.example`) |

### 3. Build and run

```sh
# Build frontend
npm run build

# Build backend
cd backend && cargo build --release

# Start server
cd backend && ./target/release/nolus-backend
```

### Development mode

Run the Vite dev server with hot-reload (requires the backend running separately):

```sh
npm run serve
```

## Commands

| Task | Command |
|------|---------|
| Build frontend | `npm run build` |
| Build backend | `cd backend && cargo build --release` |
| Dev server (Vite) | `npm run serve` |
| Frontend tests | `npm test` |
| Backend tests | `cd backend && cargo test` |
| Format frontend | `npm run format` |
| Format backend | `cd backend && cargo fmt` |
| Lint backend | `cd backend && cargo clippy` |

## License

[Apache-2.0](LICENSE)
