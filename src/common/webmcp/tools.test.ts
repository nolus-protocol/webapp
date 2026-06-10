/**
 * Source-level snapshot of the WebMCP tool surface.
 *
 * Reads tools.ts as text and pattern-extracts tool metadata. Avoids loading
 * the module (its transitive imports — Pinia stores, ThemeManager, etc. —
 * touch jsdom APIs at evaluation time and would require heavy mocking).
 *
 * This is the anti-drift guard for the project policy: connect + read +
 * navigate ONLY. If you add or remove a tool, update the expected sets below
 * consciously — the diff is the prompt to ask "is this within scope?"
 *
 * Adding any tx-signing tool (anything that calls a wallet method to sign /
 * broadcast / simulate a transaction) is forbidden by policy and is also
 * caught by the CI scope guard in .github/workflows/pr-validate.yaml.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { WalletConnectMechanism } from "@/common/types";
import { WalletActions } from "@/common/stores/wallet/types/actions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(__dirname, "tools.ts"), "utf-8");

const ALLOWED_TOOLS = [
  "connect_wallet",
  "get_balances",
  "get_connected_wallet",
  "get_earn_positions",
  "get_open_leases",
  "get_prices",
  "get_staking_delegations",
  "navigate"
] as const;

const READ_ONLY_TOOLS = [
  "get_balances",
  "get_connected_wallet",
  "get_earn_positions",
  "get_open_leases",
  "get_prices",
  "get_staking_delegations"
] as const;

const ACTION_TOOLS = ["connect_wallet", "navigate"] as const;

/**
 * Extract every `name: "<tool_name>"` literal from the tool definitions.
 * Anchored on `name:` to avoid matching arbitrary "name" strings inside
 * descriptions or comments.
 */
function extractToolNames(source: string): string[] {
  const matches = source.matchAll(/^\s*name:\s*"([^"]+)"/gm);
  return Array.from(matches, (m) => {
    const name = m[1];
    if (name === undefined) throw new Error("expected the tool-name capture group to match");
    return name;
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * For each tool name, find whether its definition block contains
 * `readOnlyHint: true`. Tool blocks are bounded by the next top-level
 * `name:` (or EOF).
 */
function extractReadOnlyTools(source: string, allNames: readonly string[]): string[] {
  const readOnly: string[] = [];
  for (const name of allNames) {
    const start = source.search(new RegExp(`name:\\s*"${escapeRegex(name)}"`));
    if (start === -1) continue;

    const tail = source.slice(start + 1);
    const nextMatch = tail.match(/\n\s{4,}name:\s*"/);
    const end = nextMatch ? start + 1 + (nextMatch.index ?? tail.length) : source.length;
    const block = source.slice(start, end);

    if (/readOnlyHint:\s*true/.test(block)) {
      readOnly.push(name);
    }
  }
  return readOnly;
}

describe("WebMCP tool surface (source-level)", () => {
  const names = extractToolNames(SOURCE);

  it("registers exactly the policy-allowed tool set", () => {
    expect(names.slice().sort()).toEqual([...ALLOWED_TOOLS].sort());
  });

  it("marks read tools with readOnlyHint=true", () => {
    const readOnly = extractReadOnlyTools(SOURCE, names).sort();
    expect(readOnly).toEqual([...READ_ONLY_TOOLS].sort());
  });

  it("does not mark action tools as read-only", () => {
    const readOnly = new Set(extractReadOnlyTools(SOURCE, names));
    const violators = ACTION_TOOLS.filter((name) => readOnly.has(name));
    expect(violators).toEqual([]);
  });

  it("uses tool names that comply with the WebMCP spec character set", () => {
    // Spec: 1–128 chars, alphanumeric + _ - . only
    const re = /^[A-Za-z0-9_.-]{1,128}$/;
    for (const n of names) {
      expect(n).toMatch(re);
    }
  });
});

/**
 * Gap-closure: source-level mechanism/action map consistency.
 *
 * Pattern-extracts MECHANISM_BY_LABEL and ACTION_BY_MECHANISM, then asserts:
 *   - every value in MECHANISM_BY_LABEL is a real WalletConnectMechanism member
 *   - every mechanism in MECHANISM_BY_LABEL is also a key in ACTION_BY_MECHANISM
 *   - every value of ACTION_BY_MECHANISM is a real WalletActions member
 *   - the "phantom" label is mapped to SOL_PHANTOM (locks in the rename)
 *   - SOL_PHANTOM is mapped to CONNECT_SOL_PHANTOM
 *   - the deleted EVM_PHANTOM / CONNECT_EVM_PHANTOM identifiers do not appear
 *
 * Catches the rename-desync failure mode where WalletConnectMechanism or
 * WalletActions enums are renamed but tools.ts still references old members.
 */
describe("WebMCP mechanism/action map consistency", () => {
  function extractObjectLiteral(source: string, name: string): Record<string, string> {
    const literalRe = new RegExp("const\\s+" + name + "[^=]*=\\s*\\{([\\s\\S]*?)\\}\\s*;");
    const m = source.match(literalRe);
    const body = m?.[1];
    if (body === undefined) throw new Error("Could not find object literal for " + name);
    const out: Record<string, string> = {};
    const entryRe =
      /(?:(\w+)|\[\s*WalletConnectMechanism\.(\w+)\s*\])\s*:\s*(?:WalletConnectMechanism|WalletActions)\.(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = entryRe.exec(body)) !== null) {
      const key = match[1] ?? match[2];
      const value = match[3];
      if (key === undefined || value === undefined) throw new Error("unparsable mechanism/action map entry");
      out[key] = value;
    }
    return out;
  }

  const mechanismByLabel = extractObjectLiteral(SOURCE, "MECHANISM_BY_LABEL");
  const actionByMechanism = extractObjectLiteral(SOURCE, "ACTION_BY_MECHANISM");

  it("every MECHANISM_BY_LABEL value is a real WalletConnectMechanism member", () => {
    const validMembers = new Set(Object.keys(WalletConnectMechanism));
    for (const [label, member] of Object.entries(mechanismByLabel)) {
      expect(validMembers, `label "${label}" maps to unknown mechanism ${member}`).toContain(member);
    }
  });

  it("every mechanism in MECHANISM_BY_LABEL is also a key in ACTION_BY_MECHANISM", () => {
    for (const [label, member] of Object.entries(mechanismByLabel)) {
      expect(
        actionByMechanism,
        `mechanism for label "${label}" (${member}) missing from ACTION_BY_MECHANISM`
      ).toHaveProperty(member);
    }
  });

  it("every ACTION_BY_MECHANISM value is a real WalletActions member", () => {
    const validActions = new Set(Object.keys(WalletActions));
    for (const [mechanism, action] of Object.entries(actionByMechanism)) {
      expect(validActions, `mechanism ${mechanism} maps to unknown action ${action}`).toContain(action);
    }
  });

  it("label 'phantom' maps to SOL_PHANTOM (post-rename contract)", () => {
    expect(mechanismByLabel.phantom).toBe("SOL_PHANTOM");
  });

  it("SOL_PHANTOM maps to CONNECT_SOL_PHANTOM in ACTION_BY_MECHANISM", () => {
    expect(actionByMechanism.SOL_PHANTOM).toBe("CONNECT_SOL_PHANTOM");
  });

  it("does NOT reference the removed EVM_PHANTOM mechanism or CONNECT_EVM_PHANTOM action", () => {
    expect(SOURCE).not.toMatch(/EVM_PHANTOM/);
    expect(SOURCE).not.toMatch(/CONNECT_EVM_PHANTOM/);
  });
});
