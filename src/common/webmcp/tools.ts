/**
 * WebMCP tool definitions.
 *
 * Each tool is a thin adapter over Pinia stores — they read whatever the user's
 * already-loaded session has, so calls are essentially free (no extra backend hits).
 *
 * Tilt the surface toward wallet-scoped + UI-driven tools — the stdio MCP server
 * in @nolus/nolusjs already covers the universal read-only queries.
 *
 * SCOPE BOUNDARY: connect + read + navigate ONLY. Never expose tx-signing tools
 * (open lease, deposit, stake, vote, swap, etc.) via WebMCP. Transactions must
 * stay inside the explicit user-driven UI flow with the wallet popup as the
 * single authoritative consent surface.
 */

import type { Router } from "vue-router";
import {
  useConnectionStore,
  useBalancesStore,
  useLeasesStore,
  useEarnStore,
  useStakingStore,
  usePricesStore,
  useWalletStore,
  WalletActions
} from "@/common/stores";
import { RouteNames } from "@/router/RouteNames";
import { WalletManager } from "@/common/utils/WalletManager";
import { WalletConnectMechanism } from "@/common/types";

interface ToolAnnotations {
  readOnlyHint?: boolean;
}

export interface WebMcpClient {
  requestUserInteraction<T>(callback: () => Promise<T>): Promise<T>;
}

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown, client?: WebMcpClient) => Promise<unknown>;
  annotations?: ToolAnnotations;
}

const MECHANISM_BY_LABEL: Record<string, WalletConnectMechanism> = {
  keplr: WalletConnectMechanism.KEPLR,
  leap: WalletConnectMechanism.LEAP,
  phantom: WalletConnectMechanism.EVM_PHANTOM,
  solflare: WalletConnectMechanism.SOL_SOLFLARE,
  ledger: WalletConnectMechanism.LEDGER
};

const ACTION_BY_MECHANISM: Record<WalletConnectMechanism, WalletActions> = {
  [WalletConnectMechanism.KEPLR]: WalletActions.CONNECT_KEPLR,
  [WalletConnectMechanism.LEAP]: WalletActions.CONNECT_LEAP,
  [WalletConnectMechanism.EVM_PHANTOM]: WalletActions.CONNECT_EVM_PHANTOM,
  [WalletConnectMechanism.SOL_SOLFLARE]: WalletActions.CONNECT_SOL_SOLFLARE,
  [WalletConnectMechanism.LEDGER]: WalletActions.CONNECT_LEDGER,
  [WalletConnectMechanism.LEDGER_BLUETOOTH]: WalletActions.CONNECT_LEDGER
};

const MECHANISM_LABELS = Object.keys(MECHANISM_BY_LABEL);

const NO_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false
} as const;

const ROUTE_VALUES = Object.values(RouteNames) as string[];

export function buildTools(router: Router): WebMcpTool[] {
  return [
    {
      name: "get_connected_wallet",
      title: "Get connected wallet",
      description:
        "Returns the currently connected Nolus wallet (bech32 address) and connection status. " +
        "If `connected` is false, the user needs to click the Connect Wallet button in the UI before " +
        "wallet-scoped tools (balances, leases, earn, staking) will return data.",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const conn = useConnectionStore();
        return {
          connected: conn.isWalletConnected,
          address: conn.walletAddress,
          ws_state: conn.wsState
        };
      }
    },

    {
      name: "get_balances",
      title: "Get token balances",
      description:
        "Returns the connected wallet's token balances across all supported assets, with the " +
        "aggregate USD value. Returns an empty array when no wallet is connected.",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const balances = useBalancesStore();
        return {
          address: balances.address,
          total_value_usd: balances.totalValueUsd,
          balances: balances.balances,
          last_updated: balances.lastUpdated?.toISOString() ?? null
        };
      }
    },

    {
      name: "get_open_leases",
      title: "Get open leverage positions",
      description:
        "Returns the connected wallet's open Nolus leases (leveraged spot positions) with full " +
        "per-position state — collateral, debt, status, and any optimistic in-progress flag — plus " +
        "aggregate unrealized PnL and total collateral value in USD. Includes the WebSocket-driven " +
        "live status that REST snapshots may not yet reflect.",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const leases = useLeasesStore();
        return {
          owner: leases.owner,
          count: leases.openLeases.length,
          total_pnl: leases.totalPnl.toString(),
          total_collateral_usd: leases.totalCollateralUsd.toString(),
          leases: leases.openLeases,
          last_updated: leases.lastUpdated?.toISOString() ?? null
        };
      }
    },

    {
      name: "get_earn_positions",
      title: "Get liquidity pool positions",
      description:
        "Returns the connected wallet's liquidity provider positions in Nolus earn pools, plus the " +
        "list of available pools with their current APYs. Use the pool list to suggest where the " +
        "user could deposit additional funds.",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const earn = useEarnStore();
        return {
          address: earn.address,
          total_deposited_usd: earn.totalDepositedUsd,
          positions: earn.positions,
          pools: earn.pools.map((p) => ({
            protocol: p.protocol,
            apy: p.apy,
            lpp_address: p.lpp_address
          })),
          last_updated: earn.lastUpdated?.toISOString() ?? null
        };
      }
    },

    {
      name: "get_staking_delegations",
      title: "Get NLS staking delegations",
      description:
        "Returns the connected wallet's NLS staking delegations, unbonding entries, and claimable " +
        "rewards across validators, with aggregate totals.",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const staking = useStakingStore();
        return {
          address: staking.address,
          total_staked: staking.totalStaked,
          total_rewards: staking.totalRewards,
          delegations: staking.delegations,
          unbonding: staking.unbonding,
          rewards: staking.rewards,
          last_updated: staking.lastUpdated?.toISOString() ?? null
        };
      }
    },

    {
      name: "get_prices",
      title: "Get oracle prices",
      description:
        "Returns the current oracle prices for all supported assets, keyed by `ticker@protocol` or " +
        "IBC denom. Updated in real time via WebSocket (~6s cadence).",
      inputSchema: NO_INPUT_SCHEMA,
      annotations: { readOnlyHint: true },
      async execute() {
        const prices = usePricesStore();
        return {
          prices: prices.prices,
          last_updated: prices.lastUpdated?.toISOString() ?? null
        };
      }
    },

    {
      name: "connect_wallet",
      title: "Connect wallet",
      description:
        "Open the user's wallet extension to connect a wallet. Pass `mechanism` to pick the extension " +
        `(${MECHANISM_LABELS.join(", ")}); omit it to reconnect with the previously-used extension. ` +
        "The user must approve in their extension popup. NEVER use this to sign transactions — this " +
        "tool only establishes the wallet session; tx signing is not exposed via WebMCP.",
      inputSchema: {
        type: "object",
        properties: {
          mechanism: {
            type: "string",
            enum: MECHANISM_LABELS,
            description: "Wallet extension to use. Omit to reconnect using the last-used extension."
          }
        },
        additionalProperties: false
      },
      async execute(input, client) {
        const requested = (input as { mechanism?: unknown } | null | undefined)?.mechanism;
        let mechanism: WalletConnectMechanism | undefined;

        if (typeof requested === "string") {
          mechanism = MECHANISM_BY_LABEL[requested];
          if (!mechanism) {
            throw new Error(`Unknown mechanism: ${requested}. Valid: ${MECHANISM_LABELS.join(", ")}`);
          }
        } else {
          const previous = WalletManager.getWalletConnectMechanism();
          if (!previous) {
            throw new Error(
              `No previously-used wallet found. Pass mechanism (${MECHANISM_LABELS.join(", ")}) to choose one.`
            );
          }
          mechanism = previous as WalletConnectMechanism;
        }

        const action = ACTION_BY_MECHANISM[mechanism];
        if (!action) {
          throw new Error(`No connect action mapped for mechanism: ${mechanism}`);
        }

        // Wallet extensions require a user-gesture context to surface their popup.
        // Per WebMCP spec, agent-driven calls go through requestUserInteraction so
        // the browser can re-establish that gesture context before invoking the
        // extension. Fall back to a direct call if the runtime didn't supply a client.
        const connect = async () => {
          const wallet = useWalletStore();
          await wallet[action]();
          const conn = useConnectionStore();
          return {
            connected: conn.isWalletConnected,
            address: conn.walletAddress,
            mechanism
          };
        };

        return client ? client.requestUserInteraction(connect) : connect();
      }
    },

    {
      name: "navigate",
      title: "Navigate to a page",
      description: `Navigate the user to one of the dApp's main pages. Valid routes: ${ROUTE_VALUES.join(", ")}.`,
      inputSchema: {
        type: "object",
        properties: {
          route: {
            type: "string",
            enum: ROUTE_VALUES,
            description: "Target route name."
          }
        },
        required: ["route"],
        additionalProperties: false
      },
      async execute(input) {
        const route = (input as { route?: unknown } | null | undefined)?.route;
        if (typeof route !== "string" || !ROUTE_VALUES.includes(route)) {
          throw new Error(`Unknown route: ${String(route)}. Valid: ${ROUTE_VALUES.join(", ")}`);
        }
        await router.push({ name: route });
        return { navigated_to: route };
      }
    }
  ];
}
