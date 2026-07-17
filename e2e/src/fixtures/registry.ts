/**
 * The fixture set: a request-path -> fixture-file table plus the schema (if any) each
 * body is validated against. Shared by the Node-side loader/validator tests and the
 * browser-side fixture-mode interceptor, so the two never drift.
 *
 * `schema` names a whole-body object schema; `itemSchema` names a per-element schema for
 * a bare-array body (e.g. `/api/earn/pools`). Endpoints with neither are schemaless
 * (all `/api/etl/*`, `/api/governance/*`, `/api/staking/*`, and the config scaffolding):
 * their fixtures are shape-mirrored and guarded live against key-set drift, never parsed.
 */

export type FixtureScope = "common" | "stats" | "vote" | "wallet";

export type SchemaName =
  | "prices-response"
  | "gas-fee-config-response"
  | "leases-response"
  | "earn-pool"
  | "earn-positions-response"
  | "balances-response"
  | "skip-route-config";

export interface FixtureRoute {
  /** Stable id for the coverage matrix and diagnostics. */
  id: string;
  /** Matches a request pathname (query stripped). More specific entries come first. */
  pattern: RegExp;
  /** Fixture file relative to the repo-root `fixtures/` directory. */
  file: string;
  scope: FixtureScope;
  /** Whole-body object schema, when the endpoint has a Zod schema. */
  schema?: SchemaName;
  /** Per-item schema when the body is a bare JSON array. */
  itemSchema?: SchemaName;
}

const COMMON: readonly FixtureRoute[] = [
  { id: "locales-en", pattern: /^\/api\/locales\/en$/, file: "common/locales-en.json", scope: "common" },
  { id: "networks-gated", pattern: /^\/api\/networks\/gated$/, file: "common/networks-gated.json", scope: "common" },
  { id: "protocols-gated", pattern: /^\/api\/protocols\/gated$/, file: "common/protocols-gated.json", scope: "common" },
  { id: "config", pattern: /^\/api\/config$/, file: "common/config.json", scope: "common" },
  {
    id: "gas-config",
    pattern: /^\/api\/fees\/gas-config$/,
    file: "common/fees-gas-config.json",
    scope: "common",
    schema: "gas-fee-config-response"
  },
  { id: "currencies", pattern: /^\/api\/currencies$/, file: "common/currencies.json", scope: "common" },
  { id: "node-info", pattern: /^\/api\/node\/info$/, file: "common/node-info.json", scope: "common" },
  {
    id: "protocol-currencies-usdc-noble",
    pattern: /^\/api\/protocols\/OSMOSIS-OSMOSIS-USDC_NOBLE\/currencies$/,
    file: "common/protocols-osmosis-usdc-noble-currencies.json",
    scope: "common"
  },
  {
    id: "protocol-currencies-osmo",
    pattern: /^\/api\/protocols\/OSMOSIS-OSMOSIS-OSMO\/currencies$/,
    file: "common/protocols-osmosis-osmo-currencies.json",
    scope: "common"
  },
  {
    id: "protocol-currencies-all-btc",
    pattern: /^\/api\/protocols\/OSMOSIS-OSMOSIS-ALL_BTC\/currencies$/,
    file: "common/protocols-osmosis-all-btc-currencies.json",
    scope: "common"
  },
  {
    id: "protocol-currencies-fallback",
    pattern: /^\/api\/protocols\/[^/]+\/currencies$/,
    file: "common/protocols-osmosis-usdc-noble-currencies.json",
    scope: "common"
  },
  {
    id: "network-assets",
    pattern: /^\/api\/networks\/[^/]+\/assets$/,
    file: "common/networks-osmosis-assets.json",
    scope: "common"
  },
  { id: "prices", pattern: /^\/api\/prices$/, file: "common/prices.json", scope: "common", schema: "prices-response" },
  { id: "governance-apr", pattern: /^\/api\/governance\/apr$/, file: "common/governance-apr.json", scope: "common" },
  {
    id: "earn-pools",
    pattern: /^\/api\/earn\/pools$/,
    file: "common/earn-pools.json",
    scope: "common",
    itemSchema: "earn-pool"
  },
  { id: "earn-stats", pattern: /^\/api\/earn\/stats$/, file: "common/earn-stats.json", scope: "common" },
  {
    id: "stats-overview",
    pattern: /^\/api\/etl\/batch\/stats-overview$/,
    file: "common/etl-batch-stats-overview.json",
    scope: "common"
  },
  {
    id: "loans-stats",
    pattern: /^\/api\/etl\/batch\/loans-stats$/,
    file: "common/etl-batch-loans-stats.json",
    scope: "common"
  },
  {
    id: "staking-validators",
    pattern: /^\/api\/staking\/validators$/,
    file: "common/staking-validators.json",
    scope: "common"
  },
  { id: "staking-params", pattern: /^\/api\/staking\/params$/, file: "common/staking-params.json", scope: "common" },
  {
    id: "supplied-funds",
    pattern: /^\/api\/etl\/supplied-funds$/,
    file: "common/etl-supplied-funds.json",
    scope: "common"
  },
  { id: "etl-pools", pattern: /^\/api\/etl\/pools$/, file: "common/etl-pools.json", scope: "common" },
  {
    id: "leased-assets",
    pattern: /^\/api\/etl\/leased-assets$/,
    file: "common/etl-leased-assets.json",
    scope: "common"
  }
];

const STATS: readonly FixtureRoute[] = [
  {
    id: "leases-monthly",
    pattern: /^\/api\/etl\/leases-monthly$/,
    file: "routes/stats/etl-leases-monthly.json",
    scope: "stats"
  },
  {
    id: "supplied-borrowed-history",
    pattern: /^\/api\/etl\/supplied-borrowed-history$/,
    file: "routes/stats/etl-supplied-borrowed-history.json",
    scope: "stats"
  }
];

const VOTE: readonly FixtureRoute[] = [
  {
    id: "hidden-proposals",
    pattern: /^\/api\/governance\/hidden-proposals$/,
    file: "routes/vote/governance-hidden-proposals.json",
    scope: "vote"
  },
  {
    id: "staking-pool",
    pattern: /^\/api\/governance\/staking-pool$/,
    file: "routes/vote/governance-staking-pool.json",
    scope: "vote"
  },
  {
    id: "proposals",
    pattern: /^\/api\/governance\/proposals$/,
    file: "routes/vote/governance-proposals.json",
    scope: "vote"
  },
  {
    id: "params-tallying",
    pattern: /^\/api\/governance\/params\/tallying$/,
    file: "routes/vote/governance-params-tallying.json",
    scope: "vote"
  }
];

const WALLET: readonly FixtureRoute[] = [
  {
    id: "balances",
    pattern: /^\/api\/balances$/,
    file: "wallet/balances.json",
    scope: "wallet",
    schema: "balances-response"
  },
  {
    id: "single-lease",
    pattern: /^\/api\/leases\/[^/]+$/,
    file: "wallet/lease-single.json",
    scope: "wallet"
  },
  { id: "leases", pattern: /^\/api\/leases$/, file: "wallet/leases.json", scope: "wallet", schema: "leases-response" },
  {
    id: "earn-positions",
    pattern: /^\/api\/earn\/positions$/,
    file: "wallet/earn-positions.json",
    scope: "wallet",
    schema: "earn-positions-response"
  },
  {
    id: "staking-positions",
    pattern: /^\/api\/staking\/positions$/,
    file: "wallet/staking-positions.json",
    scope: "wallet"
  },
  {
    id: "user-dashboard",
    pattern: /^\/api\/etl\/batch\/user-dashboard$/,
    file: "wallet/etl-batch-user-dashboard.json",
    scope: "wallet"
  }
];

/** All fixture routes, ordered specific-before-general for first-match resolution. */
export const FIXTURE_ROUTES: readonly FixtureRoute[] = [...WALLET, ...STATS, ...VOTE, ...COMMON];

export function resolveFixtureRoute(pathname: string): FixtureRoute | undefined {
  return FIXTURE_ROUTES.find((route) => route.pattern.test(pathname));
}
