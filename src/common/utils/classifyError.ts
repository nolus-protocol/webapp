import { ApiError } from "@/common/api";

const SWAP_ROUTE_FAILED_CODE = "SWAP_ROUTE_FAILED";
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Map a downstream failure (Skip route, contract simulation, RPC, backend API)
 * to a cause-specific i18n message key. Returns the key — callers translate it
 * with their own `i18n.t(...)` so the message stays reactive to locale changes
 * and this helper stays pure and unit-testable. Never surface a raw chain/RPC
 * string on a form field.
 *
 * Only a message that mentions liquidity maps to "no-liquidity"; every other
 * unrecognised failure is the generic "unexpected-error", never a mislabel
 * (see the lease-quote error-classification note in the project CLAUDE.md).
 */
export function classifyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === SWAP_ROUTE_FAILED_CODE) {
      return "message.swap-route-failed";
    }
    if (error.status === HTTP_TOO_MANY_REQUESTS) {
      return "message.rate-limit-exceeded";
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/liquidity/i.test(message)) {
    return "message.no-liquidity";
  }

  return "message.unexpected-error";
}
