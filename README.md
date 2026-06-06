# Nolus Webapp

A DeFi money market web application for the [Nolus](https://nolus.io) protocol. Enables leveraged positions, earning via liquidity pools, staking, cross-chain swaps, and governance on the Nolus network.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Pinia, Vite, Tailwind CSS, vue-i18n |
| Backend | Rust (Axum, Tokio) |
| Blockchain | CosmJS, @nolus/nolusjs, cosmrs |
| Networks | Nolus, Osmosis, Neutron |
| Wallets | Keplr, Ledger (USB + Bluetooth), Phantom, Solflare |

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
| `.env.serve` | Vite dev server mode (`npm run serve`) — user-created, not shipped |
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
| Lint frontend | `npm run lint` |
| Lint backend | `cd backend && cargo clippy` |

## Updating the web-components UI library

The UI primitives (buttons, inputs, dialogs, dropdowns, toasts) come from [`nolus-protocol/web-components`](https://github.com/nolus-protocol/web-components), pinned by git tag in `package.json`. Because it is a git dependency, the tag and the lockfile must be bumped **together** — a tag bump alone leaves `package-lock.json` (and every `npm ci` in CI and the deploy workflows) on the old commit, silently shipping a stale library whose components can differ from what the app expects.

To bump the library:

1. Edit the pin in `package.json`:

   ```json
   "web-components": "github:nolus-protocol/web-components#vX.Y.Z"
   ```

2. Refresh the lockfile (do **not** hand-edit it):

   ```sh
   npm install
   ```

3. Commit **both** `package.json` and `package-lock.json` in the same change and open a PR, so `pr-validate` reinstalls from the new lockfile.

4. Verify the installed version matches the pin:

   ```sh
   npm ls web-components
   ```

Never float the version at deploy time — both deploy workflows run `npm ci`, which installs strictly from the committed lockfile.

## License

[Apache-2.0](LICENSE)
