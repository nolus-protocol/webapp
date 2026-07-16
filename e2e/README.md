# nolus-webapp-e2e

A standalone, real-environment QA suite for the Nolus webapp. It exercises a live
staging origin the way the app does (over the public HTTP and WebSocket API) and
asserts invariants that unit tests inside the app cannot see.

It is a separate npm package (its own `package.json` and lockfile) so the repo-root
`npm ci` never installs it. Node 22+.

## Tiers

The suite is organized into tiers of increasing fidelity. This package currently
ships **T0** only.

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

| Script                            | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `npm run t0`                      | Run the T0 suite.                     |
| `npm run typecheck`               | `tsc --noEmit`.                       |
| `npm run lint`                    | ESLint (type-checked), zero warnings. |
| `npm run format` / `format:check` | Prettier.                             |
| `npm test`                        | Vitest unit tests.                    |

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

## Known coverage gaps

- `ws-rest-parity` may report `skip` on a quiet address: the backend only pushes a
  `balance_update` when a live on-chain transfer touches the subscribed address. A
  deterministic trigger arrives with the T2 wallet tier.
- `rate-unit-sanity` is vacuous (degenerate pass) for an address with no open leases.
- `totals-reconcile` is degenerate for an unfunded address (zero balances).

Pick a configured address that is funded and, ideally, holds an open lease to make all
three checks non-degenerate.

## Conventions

Every PR that adds or changes a user-facing surface (route, form, flow, rendered value,
error state, WS topic) must update the affected tier specs and the coverage matrix in
the same PR or link a follow-up issue. A feature is not done while this suite renders
it invisible.
