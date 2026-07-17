import { getJson } from "../http.js";
import { resolveOrigin } from "../t2/appDriver.js";
import { createWalletIdentity } from "../signer.js";
import { DEFAULT_ALERT_TIMEOUT_MS } from "./alert.js";
import { makeScrubber } from "./scrub.js";

// Coverage-excluded (see vitest.config.ts): pre-flight funding check, the only reporting-tier
// module that touches the wallet signer and the live chain read. It derives the primary address,
// reads its USDC holding through the same host-resolver-aware undici path the flows use, and warns
// (never fails) when the balance has fallen below the floor — a degraded budget must be announced
// before the value-moving specs start skipping forever, not discovered from a silent skip list.

const DEFAULT_LOW_WATER = 45;
const USDC_SYMBOL = /usdc/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numericField(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return value.trim().length > 0 && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function usdcHolding(payload: unknown): number | null {
  if (!isRecord(payload) || !Array.isArray(payload.balances)) {
    return null;
  }
  for (const entry of payload.balances) {
    if (!isRecord(entry)) {
      continue;
    }
    const symbol = typeof entry.symbol === "string" ? entry.symbol : typeof entry.key === "string" ? entry.key : "";
    if (USDC_SYMBOL.test(symbol)) {
      return numericField(entry.amount_usd) ?? numericField(entry.amount);
    }
  }
  return null;
}

async function postWarning(webhook: string, summary: string): Promise<void> {
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suite: "e2e-regression", urgency: "low", kind: "budget-preflight", summary }),
      // Same abort deadline as alert.ts so a black-hole webhook can't hang the pre-flight step.
      signal: AbortSignal.timeout(DEFAULT_ALERT_TIMEOUT_MS)
    });
  } catch {
    process.stderr.write("preflight: warning alert delivery failed\n");
  }
}

async function run(): Promise<void> {
  const scrub = makeScrubber([process.env.E2E_SCRUB_VALUE ?? ""]);
  const mnemonic = process.env.E2E_WALLET_MNEMONIC ?? "";
  if (mnemonic.length === 0) {
    process.stdout.write("preflight: no primary mnemonic configured; skipping budget check\n");
    return;
  }
  const floor = numericField(process.env.E2E_USDC_LOW_WATER) ?? DEFAULT_LOW_WATER;
  const ctx = resolveOrigin();
  let balance: number | null;
  try {
    const { address } = await createWalletIdentity(mnemonic);
    const payload = await getJson(`${ctx.origin}/api/balances?address=${encodeURIComponent(address)}`, ctx.dispatcher);
    balance = usdcHolding(payload);
  } catch (error) {
    process.stdout.write(
      scrub(`preflight: balance read failed, continuing: ${error instanceof Error ? error.message : String(error)}\n`)
    );
    return;
  }
  if (balance === null) {
    process.stdout.write("preflight: no USDC holding found; continuing\n");
    return;
  }
  if (balance >= floor) {
    process.stdout.write(`preflight: primary USDC ${balance} at or above the ${floor} floor\n`);
    return;
  }
  const summary = `primary USDC balance below the ${floor} low-water floor — value-moving specs may start skipping; top up before the next regression run`;
  process.stdout.write(`${summary}\n`);
  const webhook = process.env.E2E_ALERT_WEBHOOK ?? "";
  if (webhook.length > 0) {
    await postWarning(webhook, summary);
  } else {
    process.stderr.write("preflight: low balance but no alert webhook configured\n");
  }
}

try {
  await run();
} catch (error) {
  process.stderr.write(
    `preflight: unexpected error, continuing: ${error instanceof Error ? error.message : String(error)}\n`
  );
}
