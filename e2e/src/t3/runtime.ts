import type { OriginContext } from "../t2/appDriver.js";
import { getJson } from "../http.js";
import { sanitizeRpc } from "../transfer.js";
import type { SerialQueue } from "./serialQueue.js";
import type { SweepDeps } from "./reconcile.js";

// Live wiring that binds the pure engine to the real network / fs. Coverage-excluded (see
// vitest.config.ts): this is the only place src/t3 touches undici and the chain. Every unit of
// logic it composes — the pacer, the sweep classification, the cap, the journal — is unit-tested
// through its pure module.

const SWAP_PATH = /\/api\/swap\//;

/**
 * A host-resolver-aware JSON read whose failures are stripped of any RPC/target host before they
 * escape — the host resolver maps the public base domain to an internal address, so a raw undici
 * connect error would otherwise carry that internal host/IP into a report or a CI artifact. This
 * mirrors the sanitize-on-throw posture `broadcast.ts` already holds for the write path.
 */
export async function readJson(ctx: OriginContext, url: string): Promise<unknown> {
  try {
    return await getJson(url, ctx.dispatcher);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line preserve-caught-error -- cause intentionally dropped: it carries the raw RPC host; message re-thrown through sanitizeRpc
    throw new Error(sanitizeRpc(raw, ctx.origin));
  }
}

/**
 * A rate-paced JSON reader for the reconciliation sweep. Reads to `/api/swap/*` draw from the
 * strict bucket, every other read from the standard bucket — the same single budget the queue's
 * submissions share, because nginx rewrites XFF so the whole suite counts as one client IP.
 * Read failures are sanitized so the sweep never leaks the internal target host.
 */
export function pacedSweepDeps(queue: SerialQueue, ctx: OriginContext): SweepDeps {
  return {
    fetchJson: async (url: string): Promise<unknown> => {
      await queue.pace(SWAP_PATH.test(url) ? "strict" : "standard");
      return readJson(ctx, url);
    }
  };
}
