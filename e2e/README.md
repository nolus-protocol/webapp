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

| Script                            | Purpose                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `npm run t0`                      | Run the T0 suite.                                                                 |
| `npm run t1`                      | Run the T1 browser smoke (Playwright).                                            |
| `npm run t2`                      | Run the full T2 suite (t2 → ratelimit → receive, serial).                         |
| `npm run t2:matrix`               | Run only the parallel-safe T2 project (connect, validation, classify, reconnect). |
| `npm run t2:ratelimit`            | Run the rate-limit spec (with its `t2` dependency).                               |
| `npm run t2:receive`              | Run the receive spec (with its `t2`/`ratelimit` dependencies).                    |
| `npm run t3:engine`               | Run the T3 tx-engine smoke (value-moving; CI dispatch with tiny caps).            |
| `npm run t3:flows`                | Run the T3 value-moving flow specs (CI dispatch within the spend caps).           |
| `npm run report`                  | Aggregate a run's artifacts into `results/report.json` + `report.md`.             |
| `npm run report:preflight`        | Budget pre-flight: warn via the alert webhook when USDC nears the lease floor.    |
| `npm run typecheck`               | `tsc --noEmit`.                                                                   |
| `npm run lint`                    | ESLint (type-checked), zero warnings.                                             |
| `npm run format` / `format:check` | Prettier.                                                                         |
| `npm test` / `test:coverage`      | Vitest unit tests (+ coverage gate).                                              |

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

### `priced-balances-nonzero`

Fetches `GET /api/balances`, `GET /api/currencies`, and `GET /api/prices` for the
configured address. Each balance denom is resolved to its ticker via `/api/currencies`
(the shared `denomResolver` used by the T3 tier — assets are identified by bank denom,
never by the entry's `symbol`/`amount_usd`). For every balance whose ticker has **any**
`TICKER@…` price key in `/api/prices` and a positive held amount, it asserts
`amount_usd` parses to a value **strictly greater than zero**. This guards the balances
USD-join: a held, priced asset must never render at $0. Zero-balance entries and entries
whose ticker has no price key are **exempt**. With no priced, non-zero balances the check
**passes** with a degenerate note.

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

| Variable                 | Required | Meaning                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`           | yes      | HTTPS origin of the SPA/API. Fails config load loudly before any browser launches.                                                                                                                                                                                                            |
| `E2E_HOST_RESOLVER`      | no       | Optional `host=target` connect overrides, reused from T0/T1. Its value is never echoed.                                                                                                                                                                                                       |
| `E2E_WALLET_MNEMONIC`    | yes      | BIP-39 mnemonic (12/15/18/21/24 lowercase words) for the primary scripted account. Validated for shape only; **never echoed anywhere**, including error output and results.                                                                                                                   |
| `E2E_WALLET_MNEMONIC_2`  | no       | Second mnemonic. Used connect-only by the two-identity spec **and** as the funded account that drives the classify/rate-limit swap quotes and sends in the receive spec. When unset it falls back to a fixed, publicly-known, unfunded CosmJS test vector (funded-dependent cells then skip). |
| `E2E_EXPECT_FUNDED`      | no       | When truthy (`1`/`true`/`yes`/`on`), an unmet funded precondition becomes a hard **failure** instead of a skip — the CI mode that runs with funded accounts. Default (unset) skips with a machine-readable reason.                                                                            |
| `E2E_CHAIN_RPC`          | no       | Overrides the Nolus chain RPC the receive spec broadcasts against. Defaults to the `NOLUS` network `rpc_url` from the live `GET /api/config`.                                                                                                                                                 |
| `E2E_RECEIVE_TIMEOUT_MS` | no       | How long the receive spec waits for the rendered balance to rise after the on-chain send. Default `60000` (block time + backend detection + the ~10s balance-update debounce can exceed 30s).                                                                                                 |

The stub exposes a signing binding that any JavaScript running in the page can call,
so `E2E_WALLET_MNEMONIC` must only ever hold a dedicated, disposable e2e test wallet —
never a personal or production key.

### The T2 matrix (validation, classify, reconnect, rate-limit, receive)

Beyond connect/sign/disconnect, T2 exercises the form error surfaces, the WebSocket
reconnect path, live rate limiting, and a live on-chain receive. These run as three
Playwright projects, executed **serially** (`--workers=1` in the `t2*` npm scripts):

| Project     | Specs                                    | Wallet              | Runs after        |
| ----------- | ---------------------------------------- | ------------------- | ----------------- |
| `t2`        | connect, validation, classify, reconnect | primary + secondary | —                 |
| `ratelimit` | ratelimit                                | secondary (funded)  | `t2`              |
| `receive`   | receive                                  | primary + secondary | `t2`, `ratelimit` |

`npm run t2` runs all three in order. `npm run t2:matrix` runs only the parallel-safe
project; `npm run t2:ratelimit` / `npm run t2:receive` run those (with their dependencies).

**Why serial (workers=1).** The backend rate-limits per client IP: a strict bucket
(2 rps / burst 5) for `POST /api/swap/route`, and a shared bucket (~20 rps) for the rest.
Two parallel workers each doing a full funded-wallet page load reliably trip the shared
bucket (`429` storms on `/api/balances`, `/api/staking/positions`, …), so the funded specs
run one at a time. T1 (read-only, unfunded) stays at the config's 2 workers.

#### Validation / error matrix

Every leaf form funnels its amount-field errors through the web-components
`AdvancedFormControl` → `div.text-typography-error > span` (animated, keyed on the message),
so assertions are auto-retrying `toContainText`. Expected strings come from the live
`GET /api/locales/en` (the deploy host can drift from the repo), never hard-coded.

| Cell                           | Form route               | Trigger                       | Asserted outcome                                                                                                          |
| ------------------------------ | ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| lease long / short             | `/positions/open/{type}` | amount over an empty balance  | `invalid-balance-big` ("Insufficient balance")                                                                            |
| earn supply / withdraw         | `/earn/{type}`           | amount over an empty balance  | `invalid-balance-big`                                                                                                     |
| stake delegate / undelegate    | `/stake/{type}`          | amount over an empty balance  | `invalid-balance-big` + click-has-no-effect                                                                               |
| lease long below-minimum       | `/positions/open/long`   | funded, priced, below the min | `lease-min-error` ("Amount must be between …"), asserted by its live-resolved literal prefix; funded → asserts, else skip |
| earn withdraw over-position    | `/earn/withdraw`         | over the LP deposit           | `invalid-balance-big` (reactive `validateAmountV2` over the deposit); funded + deposit → asserts, else skip               |
| stake undelegate over-position | `/stake/undelegate`      | over the delegation           | `invalid-balance-big` (reactive `validateAmountV2` over the delegation); funded + delegation → asserts, else skip         |

`validateAmountAgainstBalance` gates before `validateMinMaxValues` (issue #192), so a
zero-balance wallet can only reach insufficient-balance; below-min/above-max and the
over-position cells require real funding and skip locally (or fail under
`E2E_EXPECT_FUNDED`). The empty-balance cells themselves rest on the opposite, **unfunded
premise**: under a funded wallet the app correctly renders a min/max or over-position error
instead, so each cell first probes the connected wallet's relevant balance/position and
records a `matrix-skip` when funded — an unfunded-premise skip that `E2E_EXPECT_FUNDED`
never escalates to a failure (distinct from the funded-gated cells above). `invalid-balance-low` and `invalid-amount` render byte-identical
text ("Invalid amount") — an **accepted blind spot**: the cells are distinguished by
trigger condition, so a key-swap between those two would pass.

**Documented app gaps** (not filed as issues — this suite is the record):

- **No form disables its submit on validation state.** The Stake buttons never set the
  native `disabled` at all (`loading` does not disable). The stake cells therefore assert
  the button-click has no effect (URL unchanged, error still shown), not a disabled state.
- **Stake Undelegate's submit failure renders nothing.** Its submit `catch` logs only and
  never calls `classifyError` (`UndelegateForm.vue`), so the over-position cell asserts
  only the reactive validation, never a submit-failure message.

#### classify seams

`classifyError` maps a downstream failure to a message key: `SWAP_ROUTE_FAILED` code →
`swap-route-failed`; HTTP `429` → `rate-limit-exceeded`; `/liquidity/i` → `no-liquidity`;
else `unexpected-error`. These are driven on the **Swap** form (not Send — see deviations):
the funded secondary wallet enters a balance-passing amount so the real
`POST /api/swap/route` fires, and the response is **mocked** (`{error:{code,message}}`, the
shape `BackendApi` reads) to the case under test. Each cell asserts the mapped message
renders inline and that the route intercept actually fired (a silent path mismatch is a red,
never a vacuous green). Every `429` additionally surfaces the global toast
(`BackendApi.onRateLimited`) — asserted on both surfaces.

#### WS reconnect

`reconnect.spec` wraps `window.WebSocket` in a pre-boot init script to capture the app's
`/ws` socket, then closes it from the page (offline emulation does **not** close an
established socket in headless chromium — verified). The app's real `onclose` runs, so it
reconnects and: re-subscribes exactly one frame per topic (`prices`, `balances`, `leases`,
`earn` — staking has no WS topic, removed in #276), refetches `balances`/`leases`/`earn`/
`staking` over REST once each (via `useWalletWatcher.onReconnect`; analytics/history are
NOT refetched), and does not crash.

#### Rate limit

`ratelimit.spec` saturates the shared strict bucket from Node (undici, same client IP via
the resolver) while the app makes its own real swap quote, so the app receives a **genuine**
`429` — surfaced inline (classifyError) and as the toast. Nothing is mocked. Its own project,
serial, running after `t2`.

#### Receive

`receive.spec` performs a Node-side bank micro-send (default `0.001` NLS) from the funded
secondary wallet to the connected primary, then asserts the rendered balance rises. NLS is
priced at ~0 USD on staging (the USD total is inert) and the assets table hides sub-1
balances, so it watches the **Swap From=NLS token balance**, which renders the real amount
unfiltered and updates reactively on the balance push. The assertion is a monotonic increase
(never a push count or exact delta — the backend debounces ~10s and coalesces same-window
sends). Its own project with `retries: 0` so a retry can never double-send, running last.

#### Skip honesty

Funded-dependent cells (lease min/max, earn-withdraw and stake-undelegate over-position,
receive) probe account state at runtime and skip with a machine-readable reason locally;
`E2E_EXPECT_FUNDED=1` turns every unmet precondition into a failure. Each skip is annotated
(`matrix-skip`) so a run can count skipped cells. The over-position cells additionally
require an existing LP deposit / delegation.

## Known coverage gaps

- The funded-wallet Dashboard/Assets **USD totals** are still not bridged against
  `/api/balances`: NLS is priced at ~0 USD on staging, so the total is degenerate and the
  assets table hides sub-1 balances. The T2 receive spec (issue #282) instead asserts a live
  balance change through the Swap From=NLS **token** amount; the T1 bridge continues to bind
  the wallet-independent `/stats` figures and the `/assets` zero-state total.
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

## The UI-correctness layer

A manual-QA-parity layer that deepens T1/T2: it independently recomputes on-screen
numbers, injects faults at the network boundary, checks element/visual integrity, adds a
deterministic fixture mode, and pins a coverage matrix. It runs in two modes — **live**
(against staging, reusing the T1/T2 harness) and **fixture** (deterministic, no backend).

### The schema seam (`fixtures/` + codegen)

Response fixtures live in the repo-root `fixtures/` directory (`common/`, `routes/<route>/`,
`wallet/`), and `fixtures/schemas/` holds JSON Schema **generated** from the app's own Zod
schemas by `scripts/gen-fixture-schemas.ts` (root). Generation uses Zod 4's native
`z.toJSONSchema()` — the third-party `zod-to-json-schema` emits an empty schema against Zod
4 and must not be used. `z.toJSONSchema()` drops the `numericString` `.refine()` (the money
field contract), so the codegen re-annotates every numericString field — detected
programmatically by a behavioural probe, never a hand list — with
`{"type":"string","pattern":"^-?(\\d+\\.?\\d*|\\.\\d+)$","minLength":1}`. Residual gap: the
pattern approximates the runtime `isFinite(Number(s))` predicate (it rejects scientific
notation and accepts over-long digit strings); it is strictly tighter for the shapes
fixtures carry. The e2e side validates every schema-backed fixture with ajv (draft 2020-12);
a unit test proves the validator **rejects** a broken fixture (wrong type / empty
numericString / missing field), so the seam can never be inert.

### The independent render oracle (`src/oracle/`)

`src/oracle/` reimplements the app's number/currency formatting — an 18-dp truncating
decimal plus the `NumberFormatUtils` / `leaseSize` / `usePositionSummary` rules — importing
**nothing** from `src/` of the app. Importing the app's formatter would only prove it equals
itself. The unit vectors pin the subtle splits: `formatDecAsUsd` truncates vs `formatUsd`
rounds, `formatTokenBalance` truncates vs `formatPrice` rounds, the `AnimateNumber` /
`TokenAmount` double-round, the compact rounding boundaries (`999.996`, `9999.995`), and the
list-row vs detail-widget SHORT divergence, PnL, and liquidation formulas.

### Fixture mode (`src/fixtures/support.ts`, `src/ui/`)

`fixtureMode` serves the fixture set over intercepted HTTP and stubs `/ws` via
`routeWebSocket` — mandatory, because the app awaits `WebSocketClient.connect()` before
config and rejects on a connect-time error, white-screening a WS-less page. The stub accepts
the socket and acks each subscribe. Every fixture-mode spec first clears a boot smoke-gate
(the shell reached interactive, not the white-screen). The fixture-mode specs:

- **`bridge.spec.ts`** — the /stats figures recomputed by the oracle; a ×2 payload mutation
  moves the render (the assertion bites).
- **`integrity.spec.ts`** — per route: interactive shell, no leaked `message.*` i18n keys, no
  broken images.
- **`faults.spec.ts`** — a 503 on a boot-critical endpoint white-screens; gated-networks 503
  fails pre-mount (Vue never mounts); governance returns 200+empty on a cold cache (never
  503); a post-boot analytics fault degrades one page; a WS hang or garbage frame is handled
  gracefully.
- **`visual.spec.ts`** — screenshots per route × theme (light/dark) × viewport
  (1440×900 + 390×844), `deviceScaleFactor` pinned to 1, reduced-motion, frozen CSS, masked
  count-up figures. **LOCAL-ONLY / NON-GATING** (CI runs no browsers). Double-run stable
  within a small `maxDiffPixels` tolerance that absorbs sub-pixel font anti-aliasing on the
  live SPA bundle; a real UI change diffs far more.

Run: `E2E_BASE_URL=… E2E_HOST_RESOLVER=… npx playwright test --project=fixture` (functional)
and `--project=visual-desktop-light` (+ `-dark`, `-mobile-light`, `-mobile-dark`) for the
baselines (`--update-snapshots` to regenerate).

**Containerized visual upgrade path.** To make the visual baselines gating, run the
`visual-*` projects inside a pinned Playwright container (`mcr.microsoft.com/playwright:v1.61.1`)
so font rendering is byte-stable, and add a browser job that reuses those baselines.

### Coverage matrix (`coverage-matrix.json`, `src/matrix/`)

`coverage-matrix.json` pins routes × components × states; every cell maps to a named
assertion label or a categorized gap (`funded-gated`, `schemaless-unvalidated`,
`visual-local-only`, `transient-state`). The guard (`npm run check:matrix`, and a vitest
integration test) **parses** the referenced spec for the label AND a real assertion in its
test block — a goto-only test cannot satisfy a cell, and a removed/renamed label reds CI.

### Documented app gaps (this suite is the record, no issue filed)

- **`/activities` ordering is unenforced client-side** — `transformTransactions` is a bare
  map; date order depends entirely on the ETL response. Recorded as a schemaless-unvalidated
  cell, not asserted as a client guarantee.
- **Schemaless endpoints** (all `/api/etl/*`, `/api/governance/*`, `/api/staking/positions`)
  have no Zod schema; their fixtures are shape-mirrored and marked unvalidated in the matrix.

### CI (the `e2e-static` job)

`pr-validate.yaml` gains one static-only job (no browsers, no network): typecheck the
codegen, regenerate the schemas and fail on drift, then the e2e package gate
(typecheck → format:check → lint → test:coverage) and the coverage-matrix guard. This is the
static gate scope of issue #305. The live and fixture-mode browser tiers run out of band.

## The T3 tx engine

The T3 layer (`src/t3/`) is the value-moving substrate the mutation specs (#283) and the
reporting tier (#285) build on. It is not a user-facing surface, so it adds nothing to the
coverage matrix; its guarantees are covered by unit tests instead. Every module except the
network/fs/browser glue (`journalStore.ts`, `runtime.ts`, `repair.ts`, the `*.spec.ts` smoke)
is pure and unit-tested — the same split the rest of the suite uses for its coverage floor.

### T3 environment variables

| Variable                | Required | Default     | Meaning                                                                              |
| ----------------------- | -------- | ----------- | ------------------------------------------------------------------------------------ |
| `E2E_SPEND_CAP_NLS`     | yes (T3) | —           | Cumulative NLS spend cap, decimal NLS, converted to micro units at parse             |
| `E2E_SPEND_CAP_USDC`    | yes (T3) | —           | Cumulative USDC spend cap, decimal USDC, converted to micro units at parse           |
| `E2E_WALLET2_LOW_WATER` | no       | `5`         | Wallet-2 native low-water floor (decimal NLS); below it the report carries a warning |
| `E2E_T3_RESULTS_DIR`    | no       | `./results` | Directory for the journal and leftover-state report                                  |

These reuse the fail-closed, all-or-nothing parse the rest of `config.ts` uses (`parseT3Config`):
every field is validated, errors accumulate, and no value is echoed except the caps (which are
not secrets). The wallet mnemonics come from the T2 variables (`E2E_WALLET_MNEMONIC`,
`E2E_WALLET_MNEMONIC_2`) and are never echoed.

### Spend cap semantics

The cap bounds **worst-case gross outflow, not net loss**. "Spend" is the attached funds plus a
deterministic gas-fee upper bound (an explicit fee, or a simulated amount times a ceiling
multiplier); the gas fee counts against the NLS cap. Accounting is **per-denom, in native micro
units** (scaled bigints via the `transfer.ts` helpers — never a float).

There is **no refund credit**. A close or unbond returns funds to the wallet later, but crediting
that back into the cap would re-open headroom and defeat the risk bound, so the accounting is
one-way. The check is a strict **pre-sign gate**: `projected = spent + pending + candidate`; if a
candidate would push any denom over its cap it returns `spend-cap-abort` and is **never signed or
broadcast**. Because the queue holds each wallet's slot until commit and the primary is the sole
spend actor, at most one governed spend is ever in flight, so at abort time nothing value-moving
is pending — the abort cannot silently drop a signed-but-uncommitted transaction.

One outflow is deliberately **outside** the SpendCap: the gas the UI-driven orphan-repair path spends. Repair runs the app's own market-close flow, whose gas the engine does not construct and cannot pre-size, so it is not gated by the cap; its worst case is bounded instead by the `maxAttempts` cap (3) times a dust per-close gas. The cap's gross-outflow guarantee therefore covers the governed spend and counterparty paths, not the repair path.

### Serialization and commit-release

`SerialQueue` is a per-wallet async FIFO: never two in-flight submissions per wallet key. A
wallet's slot is released only when its executor's returned promise **settles on commit**
(DeliverTx / block commit), never on the broadcast ack — resolving early would let the next
submission sign against a stale account sequence. Redelegations additionally hold a class mutex
that serializes them across every wallet (Cosmos forbids a delegator holding two concurrent
redelegations). A shared token bucket paces both submissions and API reads from one budget
(strict 2 RPS / burst 5 on `/api/swap/*`; standard 20 RPS / burst 50) because nginx rewrites
`X-Forwarded-For`, so the whole suite counts as a single client IP.

Retries on any spend path are **0** by contract. The kill switch (a spend-cap abort or an explicit
`abort`) drains nothing: the in-flight commit completes, every further submission is refused, and
the leftover report is emitted.

### Journal and leftover-state report (the #285 contract)

Before any broadcast the engine appends a write-ahead **intent** record (intent, wallet role,
denoms/amounts, spec, timestamp) to a JSONL journal under the results dir and `fsync`s it; the
**outcome** (txhash, commit result, classified failure) is appended when the submission settles.
A hard crash therefore still leaves the write-ahead records on disk.

The machine-readable leftover report (`t3-report.json`) is emitted on **every terminal path** —
success, app-failure, and spend-cap-abort. Shape (`version: 1`):

```json
{
  "suite": "t3",
  "version": 1,
  "generatedAt": "<iso8601>",
  "terminal": "success | app-failure | spend-cap-abort | crash",
  "openLeases": [{ "address": "...", "protocol": "...", "status": "opened" }],
  "pendingUnbondings": [{ "validatorAddress": "...", "entries": 2, "balanceMicro": "..." }],
  "unfinishedSwaps": [{ "seq": 1, "spec": "...", "denoms": [{ "denom": "...", "micro": "..." }] }],
  "spend": [{ "denom": "nls", "capMicro": "...", "spentMicro": "..." }],
  "warnings": ["..."]
}
```

`openLeases` and `pendingUnbondings` are the chain-enumerated sweep results; `unfinishedSwaps`
come from the journal because a swap is not chain-queryable. Every free-text field — journal
specs and memos, classified failure reasons, and every network read error on the sweep path — is
run through `sanitizeRpc`, so no RPC host, embedded credential, or bare IP can reach the journal,
the report, or a CI artifact.

### Reconciliation policy

The pre-run sweep enumerates `GET /api/leases?address=` and `GET /api/staking/positions?address=`.
The staking response is built from three independent chain calls, each of which can come back
empty on an upstream failure, so **partial-empty data is normal** and handled as empty — a
non-empty result is never assumed.

- Only leases with `status === "opened"` that are **orphaned** (older than the orphan grace period,
  attempt-guarded via a persisted state file) are queued for UI-driven repair. Once a lease's
  attempt count reaches the cap it becomes **report-only** and is never retried again.
- `opening` / `closing` / `paid_off` / `closed` / `liquidated` are **tolerated and reported, never
  force-repaired**.
- Pending / dust unbondings inside the 21-day window are expected leftover state — recognized and
  skipped.

All sweep reads go through the shared pacer.

**Design note — repair drives the app UI.** Orphan-lease repair does **not** construct a close
transaction in the suite. The production app builds every transaction client-side via
`@nolus/nolusjs` (a real market-close carries a Skip route plus funds), and the backend's
unsigned-tx endpoints (`/api/leases/close` and friends) are a phantom surface the app never calls.
Repair therefore drives the app's market-close flow through Playwright and the existing Keplr stub
(`t3/repair.ts`, built on the `t2` app-driver patterns), exercising the exact production
construction path with no duplicated tx logic. For #284 the repair helper ships with its UI driver;
live execution is CI-gated.

### Precondition gates

The failure taxonomy (`taxonomy.ts`) classifies every failure as `environment` (HTTP 429, relayer/
IBC delay, price move between quote and execution, node/RPC unavailability, chain-state timeout),
`app` (assertion failures, app error surfaces, contract rejects that are not liquidity/timing), or
`precondition` (unfunded, the 7-entry unbonding cap per delegator/validator pair, a maturing
redelegation lock, missing Osmosis-side funds). A precondition is skipped-not-failed leftover
state, never a red. All error text is sanitized before it is stored or annotated.

### Wallet roles

The engine asserts its wallet roles at construction: the **primary** is the only governed spend
actor; **wallet-2 (secondary)** acts only as a receive-side / micro-send counterparty. It also
refuses to run under Playwright worker parallelism > 1, so the serialization guarantees hold.

### CI (the `e2e-t3-engine.yaml` workflow)

`e2e-t3-engine.yaml` is `workflow_dispatch`-only: it installs the e2e package and runs
`npm run t3:engine` (the live engine smoke — sweep in enumerate/report mode, a serialization proof,
a spend-cap dry proof, and the single operator-approved live broadcast: a dust native send between
the primary and wallet-2). Base URL and host resolver are composed from the `base_domain` input and
the `DEPLOY_HOST` var exactly as `deploy.yaml` does — never hardcoded. Per-run caps are tiny
(`E2E_SPEND_CAP_NLS=1`, `E2E_SPEND_CAP_USDC=0`). Journal and report artifacts are uploaded on every
run, not only on failure. Automatic scheduling of this smoke (the post-deploy regression run)
belongs to issue #285, not this workflow.

## The T3 value-moving flows

### Rendered-figure and form-driving conventions (live-run hardening)

- Animated figures (AnimateNumber) carry their true formatted value only in `aria-label` — innerText is the digit-roller ladder. Every rendered-figure assertion reads the aria-label and waits for two consecutive equal reads before comparing.
- Multi-variant currency forms (earn supply/withdraw) select the wallet's funded USDC variant in the currency picker before typing; the default option can be a zero-balance variant whose validation error would otherwise persist.
- Redelegate is the app's jailed-validator recovery control (rendered only on a jailed row, icon-only): the spec runs only when the wallet holds a delegation to a jailed validator and skips cleanly otherwise.
- Lease protocol configs warm lazily server-side (503 until first request): the run pre-warms every protocol's config with one paced read at start so the cache is warm minutes later when the lease plan loads them; the paced retry and the transient classification remain as fallback.

The T3 flow specs (`src/t3/flows/`, the `t3-flows` Playwright project) are the `#283` mutation
journeys built on the tx engine. They run `workflow_dispatch`-only via `npm run t3:flows` (which
pins `--workers=1`; the singleton engine constructor throws under worker parallelism > 1), appended
to the dependency chain after `t3-engine` so the whole run shares one serialized queue, one spend
cap, one journal, and one monotonic seq allocator. The workflow is `e2e-t3-flows.yaml`, with the
real per-run caps `E2E_SPEND_CAP_NLS=100` / `E2E_SPEND_CAP_USDC=50` and a 45-minute job timeout.

### The flows

| Spec            | Flow                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `lease.spec.ts` | One lease, full lifecycle: open → TP/SL → repay → partial → market close |
| `earn.spec.ts`  | Supply then withdraw dust USDC; rendered earn total vs the oracle        |
| `stake.spec.ts` | Delegate / undelegate / redelegate / claim dust NLS, gated               |
| `send.spec.ts`  | Native NLS send primary -> wallet-2 through the engine                   |
| `ibc.spec.ts`   | Deposit + withdraw Nolus <-> Osmosis, skip-gated on Osmosis funding      |
| `swap.spec.ts`  | Quote -> execute a dust swap, tracked by the app's polled status         |

Pure helpers (side selection, the seq allocator, the tolerance comparator, precondition probes)
are unit-tested (`*.test.ts`); the run singleton, live API reads, and the form driver are
coverage-excluded browser/network glue, the same split the rest of the suite uses.

### Lease side alternation and budget math

The lease side alternates by **UTC day-of-year parity** — even opens a long, odd a short — unless
`E2E_LEASE_SIDE` (`long` / `short` / `both`) pins it. `both` is reserved for a future raised-cap
run: when the second open would exceed the USDC cap it precondition-skips rather than aborting.
No protocol accepts USDC or NLS as a lease downpayment — the `downpayment_ranges` keys are lease
**assets** (ATOM / OSMO / WETH / …), and the wallet holds only NLS + USDC. So the downpayment is
planned by `planLeaseDownpayment` over the eligible protocol configs (loaded from `GET /api/config`
`protocols[]`, each `GET /api/leases/config/<protocol>`; empty/failed configs are dropped) and the
wallet's per-asset USD holdings:

1. **Use held** — prefer a ranged asset the wallet already holds at ≥ its range min (no swap; this
   recycles the asset a prior run acquired, so acquisition becomes a no-op on later nights).
2. **Acquire** — if nothing held qualifies and the USDC balance covers `min + buffer`, acquire the
   target asset (**OSMO** — ranged by both the long and short protocols) by swapping ~$45 USDC
   through the engine: a routability probe first, then an engine-governed, journaled `swap` charged
   against the **USDC cap**, precondition-skipping if there is no route.
3. **Skip** — no held asset and an unaffordable/unroutable acquisition is a machine-readable
   precondition skip, never a red.

**Cap honesty (no silent uncapped-denom surprises):** the acquisition swap is capped in USDC. The
subsequent lease legs then move the acquired **OSMO**, whose outflow is journaled with a **zero cap
charge** (`items: [{nls, 0n}]`, display `denoms` carry the OSMO amount) and is physically bounded by
the amount acquired. The caps therefore bound the acquisition, not the recycled asset. One lease
cycle per run is roughly $45 USDC of acquisition, within the $50 USDC cap. A short lease asserts its
opened position ticker equals `resolveShortLeaseStable(currencies)` (the lease-group stable, never
the downpayment/LPN) — the `#283` short-side acceptance criterion. The rendered lease USD value is
checked against the oracle within `E2E_USD_TOLERANCE` via `assertWithinTolerance`, and every such
comparison is basis-guarded by `assertNonZeroBasis` so a would-be vacuous NLS-USD assertion (whose
oracle basis is $0) becomes a red rather than a silent pass. The liquidation cross-field check
asserts the ordering invariant (`long liq < spot < short liq`) on the same non-zero collateral leg.

### Spend-cap-abort skip semantics

A legitimate spend-cap abort halts the engine. Every value-moving spec calls `skipIfHalted` at the
top and treats an abort as a clean **precondition skip** (annotated), so a cap abort skips the
remaining flows rather than producing a red cascade of `EngineHaltedError` failures. Each terminal
writes the leftover-state report and annotates where it landed.

### Asset identity and valuation (denom resolution)

Every value probe identifies assets by **resolved bank denom**, never by the `/api/balances`
`symbol` (which carries the raw `ibc/...` hash for IBC assets) and never by `amount_usd` (unreliable,
≈0 for USDC). `denomResolver.ts` loads `/api/currencies` once per run (cached on the run singleton)
to map each ticker → its `bank_symbol` denom(s) + `decimal_digits`; a balance micro is summed by
matching `balances[].denom` against those bank symbols, and USD value comes from `/api/prices`
(`price_usd`) as `micro / 10^decimals × price` in scaled-integer decimals. Staking probes read the
nested object fields (`StakingPosition.balance.amount`, each `ValidatorReward.rewards[].amount`),
never the object as a string. The pure resolution/parse logic (`denomResolver.ts`, `staking.ts`) is
unit-tested against fixtures shaped like the real responses (hash `symbol`, object `balance`).

### Precondition gates and the failure taxonomy

Environment / precondition failures are skipped, not failed (`classifyAndRoute`); only `app`
failures are reds. A swap-route probe distinguishes a genuine no-route (a precondition) from a
probe **error** (API/network failure → an `environment` skip with its own reason), never silently
reporting an error as no-route; and every lease-downpayment skip annotates `matrix-skip` with the
plan reason. The taxonomy is extended with two precondition signals for these flows:
`lease-amount-range` (a downpayment below/above the lease range) and `swap-amount-too-small` (a
dust amount with no Skip route, distinct from a genuine `liquidity` outage). Stake gates: undelegate
is gated on the **7-entry unbonding cap** per validator (rotating the target when near it via
`pickUnbondingValidator`), redelegate on **no maturing redelegation** (and runs through the engine's
redelegate mutex), and claim on accrued rewards being **above a dust threshold**.

### Deviations

- **No confirmation dialog — the toast is the terminal signal.** The routed forms run
  `walletOperation` DIRECTLY on the footer click; there is no confirm dialog. `formDriver.submitForm`
  therefore clicks the submit once and settles on the app's terminal surface — a success **toast**
  (`div.toast`) resolves, an inline error (`div.text-typography-error`) throws — never an
  unconditional second confirm click (the earlier phantom `/confirm|submit|send/` click waited for
  UI that never appears and timed out while the tx committed underneath, journaling committed txs as
  failed). A success toast wins over a lingering error surface, and the decision over the surfaces is
  the pure, unit-tested `decideTerminal`. When neither surface appears within the timeout, the driver
  throws `terminal-signal-timeout` (classified `environment`): a broadcast may have committed after
  the click, so the journal marks that submission failed while the outcome is genuinely ambiguous —
  the **reconciliation sweep + balances read catch the untracked commit** on the next run, which is
  exactly what that pre-run sweep exists for. A just-typed amount is settled with `waitForAmountAccepted`
  (poll the inline error clear) BEFORE the submit, so the driver never reads a transient
  intermediate-typing validation error (`"0."` → "Invalid amount") as the terminal outcome.
- **RedelegateButton is a one-shot control.** Unlike the routed forms, the per-row RedelegateButton
  runs `walletOperation` directly on its click (it auto-selects destination validators — no amount
  input, no submit dialog). `stake.spec` drives it with `clickActionAndSettle` (click + settle on the
  same toast/error contract), not `typeAmount`/`submitForm`.
- **Lease-config transient outage.** `leaseProtocolConfigs` retries each `/api/leases/config/<protocol>`
  once through the shared pacer; if EVERY protocol's config load fails (a post-deploy 5xx burst, not a
  genuine no-ranges state) it throws `lease-config-unavailable` — a first-class `environment` signal
  that skips-and-retries next run, rather than returning empty and reporting a permanent-looking
  "no eligible protocol".
- **Swap tracking (`skip_tx` is dead code).** The `skip_tx` WS topic is not driven by the app —
  swaps are tracked by client polling (`SkipRouter.fetchStatus` in `useSwapForm.ts`). `swap.spec.ts`
  therefore asserts via the UI's polled terminal state and post-swap balances, not a WS event. This
  is a deliberate deviation from `#283`'s WS-tracked acceptance wording.
- **Engine journal actions.** `journal.ts`'s `IntentAction` gains `earn-supply`, `earn-withdraw`,
  `stake-claim`, `ibc-transfer`, and `lease-repay` — the value-moving actions these flows introduce
  that the `#284` engine did not yet represent. Additive only; no existing behaviour changes.
- **Crash-restart cap seeding.** `getRunContext` seeds the SpendCap's spent-state from the journal's
  committed intents (`seedCapFromJournal`) at singleton construction, from the same journal that
  seeds the seq allocator, so a worker restart cannot rebuild a full-budget cap and double-spend the
  operator budget. The charge is reconstructed **exclusively from each intent's `charged` field** —
  the cap-charged `SpendItems` actually reserved (`journaledSpend` writes them), never the display
  `denoms` — so an inflow action that journals a positive denom while charging `[{nls, 0n}]`
  (undelegate / redelegate / claim / withdraw) contributes zero on restart. A spend-cap abort is
  journaled with a first-class `precondition/spend-cap-abort` classification, never `app/unclassified`.
- **Artifact scrubbing.** `e2e-t3-flows.yaml` uploads `playwright-report/` and `test-results/`, whose
  browser traces bypass the in-suite `sanitizeRpc` and can embed the host-resolver target. A
  pre-upload scrub step runs two passes over the uploaded dirs: a text pass redacts every occurrence
  of the `E2E_HOST_RESOLVER` target (`vars.DEPLOY_HOST`), then a second pass **without** `grep -I`
  finds any file still matching — a binary the sanitizer cannot rewrite (`trace.zip`, screenshots) —
  and **deletes it outright**, logging each deletion. The step logs both the redaction and deletion
  counts. The `e2e-t3-engine.yaml` smoke uploads the same trace dirs and now runs the identical
  step (its journal/report are already sanitized; only the browser traces are the residual leak surface).
- **IBC is inert until funded.** `ibc.spec.ts` is entirely skip-gated on an Osmosis-side funding
  probe (escalated to a hard failure under `E2E_EXPECT_FUNDED`); its structure is complete but the
  live path stays inert until the counterparty side is funded. The probe uses the bech32-re-encoded
  Osmosis address (`toOsmosisAddress`, `osmo1…` — the raw `nolus1…` HRP is rejected by the Osmosis
  chain), and the probe + skip decision run **network-only, before any page navigation or the
  console-budget window opens**, so an unfunded run never navigates and never trips console errors.
- **Send receiver credit.** `send.spec.ts` renders the sender's debit (the Swap From=NLS technique)
  and confirms the receiver's credit through the balances API, since a second rendered session would
  need a reconnect and break the single-broadcast model.

## Reporting and alerting

The reporting tier (`src/report/`) folds a whole run's artifacts into one machine-readable report,
renders a human summary, and posts a classified alert. It is the arbiter for the run: the tiers
run `continue-on-error`, and the report — not any single tier's exit code — decides the run's colour.

- **Report shape (versioned).** `aggregate.ts` produces a `RunReport` carrying a `version` (bumped on
  any shape change) plus: per-tier totals (passed / failed / skipped and the per-class breakdown);
  every failure as a `ClassifiedFailure`; the genuine skips; a journal summary; the leftover-state
  section; and the runtime coverage section. `render.ts` writes the markdown summary and `cli.ts`
  writes `results/report.json` + `results/report.md`. Inputs are the per-tier Playwright JSON files
  (`results/playwright-report.json` for t1 — the config's default json output — plus `results/t2.json`,
  `results/t3-engine.json`, `results/t3-flows.json` from each tier's `PLAYWRIGHT_JSON_OUTPUT_NAME`
  override), the `t0.json` summary,
  the T3 journal (`t3-journal.jsonl`), the leftover report (`t3-report.json`), and `coverage-matrix.json`.
- **Failure classes.** Each failure is tagged `app-bug`, `env-flake`, or `spend-cap-abort`, mapped
  from the engine taxonomy: a red (unexpected) test is an `app-bug`; a t3-flow skip annotated
  `environment:` is an `env-flake`; a `precondition:` skip whose reason is a spend-cap hit is a
  `spend-cap-abort`. **Every other `precondition:` skip is a genuine skip, not a failure.** A t0
  check failure is an `app-bug` (that tier carries no taxonomy).
- **suite-suspect sub-tag.** An `app-bug` whose failure text reads like a broken locator / timeout /
  selector is sub-tagged `suite-suspect`. A stale selector is app-red in urgency but is _not_ an app
  regression — the label lets triage tell a rotted test apart from a real break.
- **Runtime-coverage honesty.** The coverage section joins the actual per-test pass/skip/fail against
  the matrix labels. A mapped cell whose test was **skipped tonight is reported as `skipped-tonight`,
  never as covered** — a skipped assertion proves nothing. Gaps are always listed. This runtime view
  complements (does not replace) the static `check:matrix` guard, which still gates every cell.
- **Missing inputs never throw.** A missing or corrupt journal / leftover report / matrix / tier file
  becomes an explicit `absent` / `corrupt` field in the report, so one torn artifact never loses the
  rest of the run.
- **Webhook contract.** `alert.ts` posts a compact classified summary to `E2E_ALERT_WEBHOOK` (a
  secret; the endpoint is never committed). The webhook is **optional** under the human-watched
  regression model. A **green** run posts nothing. An **env-flake / spend-cap only** red posts a
  **low-urgency** payload; **any app-bug** posts a **loud** payload. A **red run with no webhook
  configured** logs `no alert webhook configured — report in artifacts` and still **exits `1`** — the
  job status carries the redness and the report is in the artifacts (it is not an error to leave the
  webhook unset). Only a **configured but failed** delivery — a non-2xx response, a network error, or
  a delivery past the `DEFAULT_ALERT_TIMEOUT_MS` (15s) abort deadline — throws `alert delivery failed`
  and exits `2`, so a dropped red fails loudly rather than vanishing. Every POST carries an
  `AbortSignal.timeout` so a black-hole webhook fails fast instead of hanging the step until the job
  timeout. `cli.ts` exit codes: `0` green, `1` red, `2` alert delivery failure.
- **Scrubbing.** Every report / render / alert string is scrubbed twice: `sanitizeRpc` (bare IPv4 and
  `user:pass@` credential forms) plus explicit removal of the resolver-target value passed as
  `E2E_SCRUB_VALUE` (set by CI from `vars.DEPLOY_HOST`, never committed) and, when present in env, the
  run mnemonics. The suite's inputs are already sanitized at source; this is the belt-and-suspenders
  egress pass over `report.json`, `report.md`, and the webhook payload.
- **Scheduling (ad-hoc + post-deploy regression).** `.github/workflows/e2e-regression.yaml` runs two
  ways and **never on a cron**: a manual `workflow_dispatch` (optional `base_domain` input), and
  automatically on `workflow_run` after the **Deploy dev** workflow completes — the job's `if` gates
  that path on the deploy having **succeeded**, so a green staging deploy is immediately
  regression-validated. The target base domain resolves in one place —
  `inputs.base_domain || vars.E2E_REGRESSION_BASE_DOMAIN` — and the first step hard-fails if empty (the
  post-deploy path has no inputs, so it depends on the repo variable). That step also validates the
  resolved base against `^[A-Za-z0-9.-]+$` before writing `$GITHUB_ENV` (a newline-bearing dispatch
  input must not inject env entries) and `::add-mask::`es the resolver target so tier stdout/stderr can
  never print the internal host in the public log. The job clears `results/`, `test-results/`, and
  `playwright-report/` at the start, so `report.json` is present iff this run's cli wrote it. Tiers run
  `continue-on-error` so all of them run and the report arbitrates; the artifact scrub runs `always()`;
  the report step (also `continue-on-error`) records the cli's exit code to `$GITHUB_OUTPUT`; artifacts
  upload `always()`. **Exactly one alert leaves a run:** the cli owns it whenever a `report.json`
  exists (green→silent, red→posted, alert-failure→surfaced by the arbiter), and a final `always()`
  heartbeat fires a loud static "no report" alert **only when `report.json` is absent** (a true crash).
  A final `always()` arbiter step sets the job conclusion from the recorded cli exit code (`1` red /
  `2` alert-failure; missing code → fail closed with `1`). The run shares the `e2e-live-<base_domain>`
  concurrency group with the deploy workflow's live e2e phase so a regression run and a second deploy's
  post-run never contend for the one per-host rate-limit bucket. Both the `workflow_run` trigger and
  this workflow file must live on the default branch for the post-deploy path to fire.
- **Budget pre-flight.** Before the tiers, `report:preflight` derives the primary address, reads its
  USDC holding through the host-resolver-aware read path, and posts a low-urgency warning (then
  continues) when the balance is below `E2E_USDC_LOW_WATER` (default `45`) — a degrading budget is
  announced _before_ the value-moving specs start skipping forever, not inferred from a silent skip list.
- **Pre-release runs.** A pre-release full run is a manual `workflow_dispatch` with `prerelease: true`
  before a release cutover; it runs the same full tier set as a regression run (no grep filter).
- **Trace capture (CI-verified).** The browser projects run with `trace: retain-on-failure` and
  `screenshot: only-on-failure`; a forced-failure trace/screenshot capture is verified in CI, not by a
  unit test (the same posture as the flows' selector assertions).

## Conventions

Every PR that adds or changes a user-facing surface (route, form, flow, rendered value,
error state, WS topic) must update the affected tier specs and the coverage matrix in
the same PR or link a follow-up issue. A feature is not done while this suite renders
it invisible.
