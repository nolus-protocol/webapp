# nolus-webapp-e2e

A standalone, real-environment QA suite for the Nolus webapp. It exercises a live
staging origin the way the app does (over the public HTTP and WebSocket API) and
asserts invariants that unit tests inside the app cannot see.

It is a separate npm package (its own `package.json` and lockfile) so the repo-root
`npm ci` never installs it. Node 22+.

## Tiers

The suite is organized into tiers of increasing fidelity. This package ships **T0**
(API/WS cross-checks), **T1** (a read-only browser smoke), and **T2** (scripted-wallet
flows: connect, offline signing, disconnect).

| Tier | Scope                                                               | Wallet | Browser |
| ---- | ------------------------------------------------------------------- | ------ | ------- |
| T0   | API/WS cross-checks against a live origin (invariants, unit sanity) | no     | no      |
| T1   | Read-only rendered surfaces (routes load, values format)            | no     | yes     |
| T2   | Wallet-backed flows with a deterministic funded account             | yes    | yes     |
| T3   | Full transactional journeys (open/close lease, swap, earn)          | yes    | yes     |

## How to run

```bash
cd e2e
npm install
E2E_BASE_URL=https://app-dev.nolus.io \
E2E_READONLY_ADDRESS=nolus1youraccountaddress... \
npm run t0
```

All runtime configuration comes from environment variables. There are no baked-in
hosts: a missing required variable fails fast with a descriptive error before any
network call, and every missing/invalid variable is reported together.

| Variable                 | Required | Default                | Meaning                                                                                                                                                                                                                                                            |
| ------------------------ | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `E2E_BASE_URL`           | yes      | n/a                    | HTTPS origin of the SPA/API (e.g. `https://app-dev.nolus.io`). Must parse as an `http(s)` URL.                                                                                                                                                                     |
| `E2E_READONLY_ADDRESS`   | yes      | n/a                    | A `nolus1…` account address used by all three checks. Validated for the `nolus1` prefix and a plausible bech32 charset/length.                                                                                                                                     |
| `E2E_WS_URL`             | no       | `wss://<base-host>/ws` | WSS endpoint. Defaults to the base URL host with a `/ws` path (mirrors the app's backend/WS same-origin split).                                                                                                                                                    |
| `E2E_HOST_RESOLVER`      | no       | n/a                    | Optional DNS override pairs (`host=target`, comma-separated) for network setups where the origin must be reached at a non-default address. SNI and the `Host` header stay the original host; only the connect target changes. Its value is never echoed to output. |
| `E2E_USD_TOLERANCE`      | no       | `0.05`                 | Absolute USD tolerance for total comparisons (see rationale below).                                                                                                                                                                                                |
| `E2E_WS_PUSH_TIMEOUT_MS` | no       | `60000`                | How long the parity check waits for a live `balance_update` before reporting `skip`.                                                                                                                                                                               |
| `E2E_RATE_MIN_PERCENT`   | no       | `0`                    | Lower bound (inclusive) of the plausibility band for `annual_rate_percent`.                                                                                                                                                                                        |
| `E2E_RATE_MAX_PERCENT`   | no       | `100`                  | Upper bound (exclusive) of the plausibility band for `annual_rate_percent`.                                                                                                                                                                                        |
| `E2E_RESULTS_DIR`        | no       | `./results`            | Directory (relative to `e2e/`) where `t0.json` is written.                                                                                                                                                                                                         |

### Why a USD tolerance exists

Per-entry `amount_usd` values are decimal strings the backend has already rounded, so
a sum of rounded parts can differ from an independently rounded total by roughly
`n × 0.005` for `n` entries. A WebSocket snapshot and a REST snapshot can also straddle
a price tick between the two reads. The default `0.05` absorbs both without masking a
real unit or accounting bug. Summation is done with exact scaled-integer decimal math,
never binary floats.

### Scripts

| Script                            | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `npm run t0`                      | Run the T0 suite.                      |
| `npm run t1`                      | Run the T1 browser smoke (Playwright). |
| `npm run t2`                      | Run the T2 scripted-wallet flows.      |
| `npm run typecheck`               | `tsc --noEmit`.                        |
| `npm run lint`                    | ESLint (type-checked), zero warnings.  |
| `npm run format` / `format:check` | Prettier.                              |
| `npm test`                        | Vitest unit tests.                     |

## The T0 checks

### `ws-rest-parity`

Connects to the WSS endpoint, subscribes to the `balances` topic for the configured
address, and requires a `subscribed` acknowledgement within 10s. **An error frame or a
missing ack fails the check unconditionally.** It then waits up to
`E2E_WS_PUSH_TIMEOUT_MS` for a live `balance_update`.

- If a push arrives, it immediately fetches `GET /api/balances?address=…` and asserts
  the per-denom `(denom, amount)` multiset is exactly equal, both sides carry the six
  `BalanceInfo` fields (the WS side additionally has `chain === "nolus"` and a parseable
  timestamp), and the two `total_value_usd` values agree within `E2E_USD_TOLERANCE`.
- If no push arrives, the check is **skipped** with a machine-readable reason. The
  backend only pushes on an on-chain bank-transfer event touching the subscribed
  address (with a server-side debounce), so a quiet address produces no push. This is a
  known gap until the T2 wallet tier can inject a deterministic transfer.

The subscription is always unsubscribed and closed cleanly.

### `totals-reconcile`

Fetches `GET /api/balances?address=…` and asserts `total_value_usd` equals the exact
sum of every entry's `amount_usd` within `E2E_USD_TOLERANCE`. With zero balances the
check still **passes** but is flagged as degenerate for the configured address.

### `rate-unit-sanity`

Fetches `GET /api/leases?address=…` and, for every lease carrying an `interest` object,
asserts:

- `annual_rate_percent` is inside `[E2E_RATE_MIN_PERCENT, E2E_RATE_MAX_PERCENT)`.
- the unit identity `annual_rate_percent == (loan_rate + margin_rate) / 10` holds (the
  two component rates are raw chain permille; the annual rate is a percent).
- an `annual_rate_percent` that is an integer `≥ 100` is explicitly flagged as the
  raw-permille-leak signature (issue #270) in the failure output.

With zero inspected leases the check **passes** with a degenerate note.

## Machine-readable output

The run prints one JSON document to stdout and writes the same document to
`${E2E_RESULTS_DIR}/t0.json`:

```jsonc
{
  "suite": "t0",
  "startedAt": "<iso>",
  "finishedAt": "<iso>",
  "baseUrl": "<E2E_BASE_URL>",
  "address": "<E2E_READONLY_ADDRESS>",
  "checks": [
    {
      "id": "totals-reconcile",
      "title": "…",
      "status": "pass | fail | skip",
      "durationMs": 0,
      "observed": {}, // structured; populated on fail so a human sees what diverged
      "expected": {}, // structured
      "tolerance": {}, // optional
      "notes": "…", // optional
      "reason": "…" // optional; present on skip and most fails
    }
  ],
  "summary": { "pass": 0, "fail": 0, "skip": 0 }
}
```

**Exit code:** `1` if any check has status `fail`, otherwise `0`. A `skip` never fails
the run. The `E2E_HOST_RESOLVER` value is never present anywhere in the output.

## The T1 browser smoke

T1 drives a real headless Chromium against the live origin and asserts that every
wallet-less route renders and behaves, and that a handful of rendered numbers match the
API they come from. It never connects a wallet.

```bash
cd e2e
E2E_BASE_URL=https://app-dev.nolus.io npm run t1
```

### Projects

Three projects run every spec, so each assertion is checked at all three surfaces:

| Project         | Viewport   | Theme | Extra assertion        |
| --------------- | ---------- | ----- | ---------------------- |
| `desktop-light` | 1440 x 900 | light |                        |
| `desktop-dark`  | 1440 x 900 | dark  | `html.dark` is present |
| `mobile`        | 390 x 844  | light |                        |

Theme (`theme_data`) and language (`language` = `en`) are seeded into `localStorage`
before the SPA boots. The viewport is fixed per project because the app reads its mobile
breakpoint once at component setup.

### What the route smoke asserts

For each of the eight wallet-less routes (`/`, `/assets`, `/earn`, `/positions`,
`/stake`, `/activities`, `/vote`, `/stats`) the smoke loads the page, waits for the app
shell to become interactive, then holds a short window and asserts a per-route budget:

- zero `console.error` and zero uncaught page errors,
- zero failed same-origin requests (responses with status `>= 400`, plus request
  failures other than aborts); third-party origins are reported, not budgeted,
- exactly one WebSocket to a URL ending `/ws` opens, receives a
  `{"type":"subscribed","topic":"prices"}` acknowledgement, and stays open through the
  observation window.

Console warnings are recorded as test annotations without failing the run.

### The math-to-UI bridge

`bridge.spec.ts` proves that rendered numbers equal the numbers the backend serves:

- `/stats` overview: TVL, Tx Volume and Realized PnL (the three figures visible at every
  viewport) are each compared against `GET /api/etl/batch/stats-overview`
  (`tvl.total_value_locked`, `tx_volume.total_tx_value`, `realized_pnl_stats.amount`).
  The rendered value is read from the AnimateNumber `aria-label`, the expected value is
  formatted with the same compact-currency options the app uses, and the API value is
  re-fetched on each attempt so a live price tick does not flake the assertion. A
  within-one-percent tolerance on the parsed compact string is the documented fallback.
- `/assets` zero-state: the wallet-less assets table total renders the formatted zero
  value (`$0.00`), a real formatting-path check.

The API reads inside the bridge go through the package's own undici client with the host
resolver, because a browser API request context does not honor the Chromium host-resolver
rules.

### Post-deploy behavior

The deploy workflow runs t0 and t1 after the health probe as a single non-blocking step
(`continue-on-error`). A failure is loud (a workflow error annotation naming which tier
failed) but never fails the deploy or triggers rollback. On failure the `results/`,
`playwright-report/` and `test-results/` directories are uploaded as an artifact for
triage.

### T1 environment variables

| Variable            | Required | Meaning                                                                                                                                                  |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`      | yes      | HTTPS origin of the SPA/API. A missing value fails config load loudly before any browser launches.                                                       |
| `E2E_HOST_RESOLVER` | no       | Optional `host=target` connect overrides, reused from T0. Drives both the browser resolver rules and the bridge's API client. Its value is never echoed. |

T1 does not use `E2E_READONLY_ADDRESS`; it is wallet-less.

## The T2 scripted-wallet flows

T2 drives the app's **real** Keplr connect flow against the live origin, but with no
browser extension: a scripted `window.keplr` provider is injected before the SPA boots.
The provider implements exactly the four methods the app calls (`enable`,
`experimentalSuggestChain`, `getOfflineSignerOnlyAmino`, `getOfflineSignerAuto`) and
proxies signing to a CosmJS wallet running in Node. **The mnemonic never enters the
browser** — only a derived address, a base64 public key, and per-call amino
signatures cross the page boundary.

```bash
cd e2e
E2E_BASE_URL=https://app-dev.nolus.io \
E2E_WALLET_MNEMONIC="<throwaway 12/24-word mnemonic>" \
npm run t2
```

The `t2` project runs on a desktop viewport with the light theme. Connect needs no
funds, so any freshly generated mnemonic works; the funded account is only required for
the future T3 transactional tier.

### What T2 asserts

- **Connect** — opens the app, clicks the real Connect → Keplr controls, and asserts the
  app reaches the connected state: `localStorage.wallet_connect_mechanism === "extension"`
  and the header renders the derived `nolus1…` address. It also pins that
  `window.keplr.isKeplr === undefined` (the #155 regression class: real Keplr's Cosmos
  provider exposes no such marker, so the app must not branch on one).
- **Offline signing** — signs a representative bank-send amino doc through the stub and
  verifies in Node that the returned secp256k1 signature is cryptographically valid over
  `sha256(serializeSignDoc(doc))`, with no popup and no signing network request.
- **Disconnect** — drives the disconnect UI and asserts the wallet storage keys are
  cleared and the app returns to the disconnected state.
- **Two identities** — connects the fallback second identity and asserts its derived
  address differs from the primary's.
- **Secret hygiene** — asserts no three-word mnemonic window appears in the collected
  console output, the connected page content, or the injected init-script source.

### T2 environment variables

| Variable                | Required | Meaning                                                                                                                                                                     |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`          | yes      | HTTPS origin of the SPA/API. Fails config load loudly before any browser launches.                                                                                          |
| `E2E_HOST_RESOLVER`     | no       | Optional `host=target` connect overrides, reused from T0/T1. Its value is never echoed.                                                                                     |
| `E2E_WALLET_MNEMONIC`   | yes      | BIP-39 mnemonic (12/15/18/21/24 lowercase words) for the primary scripted account. Validated for shape only; **never echoed anywhere**, including error output and results. |
| `E2E_WALLET_MNEMONIC_2` | no       | Optional second mnemonic for the two-identity spec. When unset it falls back to a fixed, publicly-known, unfunded CosmJS test vector used connect-only.                     |

## Known coverage gaps

- The funded-wallet Dashboard and Assets wallet totals are **not** bridged. T2 now scripts
  a real Keplr connect (so the balances store does fetch for the connected address), but
  the T2 accounts are deliberately unfunded — connect needs no funds. Bridging the rendered
  Dashboard/Assets totals against `/api/balances` for a funded account is tracked in **#282**.
  Today the T1 bridge binds the wallet-independent `/stats` figures and the `/assets`
  zero-state total.
- Every new route must gain a T1 route-smoke entry in `routes.spec.ts`. A route added
  without one is a silent gap, not a passing test.
- `ws-rest-parity` may report `skip` on a quiet address: the backend only pushes a
  `balance_update` when a live on-chain transfer touches the subscribed address. A
  deterministic trigger arrives with the T2 wallet tier. Until then the wire-shape
  classification of pushed frames is exercised in unit tests against byte-exact
  fixtures; a malformed `balance_update` (shape drift) fails the check rather than
  masking as a timeout skip.
- `rate-unit-sanity` is vacuous (degenerate pass) for an address with no open leases.
- `totals-reconcile` is degenerate for an unfunded address (zero balances).

Pick a configured address that is funded and, ideally, holds an open lease to make all
three checks non-degenerate.

## Conventions

Every PR that adds or changes a user-facing surface (route, form, flow, rendered value,
error state, WS topic) must update the affected tier specs and the coverage matrix in
the same PR or link a follow-up issue. A feature is not done while this suite renders
it invisible.
