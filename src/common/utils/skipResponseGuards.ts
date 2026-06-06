/**
 * Runtime guards for Skip API responses proxied through the backend.
 *
 * The backend types these payloads loosely (e.g. `operations: unknown[]`), while
 * the frontend consumes a richer shape. Rather than launder the gap with an
 * `as`-cast, each guard validates the fields the swap flow actually dereferences
 * and throws on a malformed response — so a bad payload fails before it can drive
 * transaction construction. Errors are surfaced through the shared form classifier.
 *
 * The checks are intentionally minimal: every field asserted here is already
 * required in the backend response type, so a valid response can never trip them.
 * They are top-level shape checks only — the nested message contents are validated
 * downstream where they are decoded (`SkipRouter.getTx` throws on unknown msg types).
 */
import type { Chain, RouteResponse, MessagesResponse } from "@/common/types/skipRoute";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function assertRouteResponse(value: unknown): asserts value is RouteResponse {
  if (
    !isRecord(value) ||
    typeof value.amount_in !== "string" ||
    typeof value.amount_out !== "string" ||
    typeof value.source_asset_denom !== "string" ||
    typeof value.dest_asset_denom !== "string" ||
    typeof value.source_asset_chain_id !== "string" ||
    typeof value.dest_asset_chain_id !== "string" ||
    !Array.isArray(value.chain_ids) ||
    !Array.isArray(value.operations)
  ) {
    throw new Error("Malformed Skip route response");
  }
}

export function assertMessagesResponse(value: unknown): asserts value is MessagesResponse {
  if (!isRecord(value) || !Array.isArray(value.txs)) {
    throw new Error("Malformed Skip messages response");
  }
}

export function assertChainList(value: unknown): asserts value is Chain[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (chain) => isRecord(chain) && typeof chain.chain_id === "string" && typeof chain.chain_name === "string"
    )
  ) {
    throw new Error("Malformed Skip chains response");
  }
}
