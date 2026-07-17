import type { ClassifiedFailure, RunReport, TierTotals } from "./aggregate.js";

export type Urgency = "loud" | "low";
type RunColor = "green" | "app" | "flake";
type Scrubber = (text: string) => string;

// A black-hole webhook (accepts the connection, never responds) would otherwise hang the alert
// step until the job timeout. Bound every POST with an abort signal so a stuck delivery fails
// fast down the same `alert delivery failed` path a network error takes.
export const DEFAULT_ALERT_TIMEOUT_MS = 15000;

export class AlertDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlertDeliveryError";
  }
}

export interface AlertRequest {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface AlertResponse {
  ok: boolean;
  status: number;
}

export type AlertFetch = (url: string, request: AlertRequest) => Promise<AlertResponse>;

export interface AlertConfig {
  webhookUrl: string | undefined;
  fetchImpl: AlertFetch;
  scrub: Scrubber;
  // Overridable so a unit test can inject an already-aborted signal instead of waiting on a clock.
  makeSignal?: () => AbortSignal;
}

export type AlertResult = { posted: false; reason: "green" | "unconfigured" } | { posted: true; urgency: Urgency };

interface AlertPayloadFailure {
  tier: string;
  test: string;
  failureClass: ClassifiedFailure["failureClass"];
  suiteSuspect: boolean;
}

interface AlertPayloadTier {
  tier: string;
  passed: number;
  failed: number;
  skipped: number;
}

interface AlertPayload {
  suite: "e2e-regression";
  version: number;
  urgency: Urgency;
  generatedAt: string;
  summary: string;
  tiers: AlertPayloadTier[];
  failures: AlertPayloadFailure[];
}

function runColor(report: RunReport): RunColor {
  if (report.failures.some((failure) => failure.failureClass === "app-bug")) {
    return "app";
  }
  return report.failures.length > 0 ? "flake" : "green";
}

function summaryLine(report: RunReport, urgency: Urgency, scrub: Scrubber): string {
  const counts = new Map<string, number>();
  for (const failure of report.failures) {
    counts.set(failure.failureClass, (counts.get(failure.failureClass) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()].map(([failureClass, count]) => `${failureClass}=${count}`).join(", ");
  return scrub(`${urgency} — ${report.failures.length} classified failure(s)${breakdown ? `: ${breakdown}` : ""}`);
}

function payloadTier(tier: TierTotals): AlertPayloadTier {
  return { tier: tier.tier, passed: tier.passed, failed: tier.failed, skipped: tier.skipped };
}

function payloadFailure(failure: ClassifiedFailure, scrub: Scrubber): AlertPayloadFailure {
  return {
    tier: scrub(failure.tier),
    test: scrub(failure.test),
    failureClass: failure.failureClass,
    suiteSuspect: failure.suiteSuspect
  };
}

function buildPayload(report: RunReport, urgency: Urgency, scrub: Scrubber): AlertPayload {
  return {
    suite: "e2e-regression",
    version: report.version,
    urgency,
    generatedAt: report.generatedAt,
    summary: summaryLine(report, urgency, scrub),
    tiers: report.tiers.map(payloadTier),
    failures: report.failures.map((failure) => payloadFailure(failure, scrub))
  };
}

/**
 * Post the classified run summary to the alert webhook. A green run posts nothing. An env-flake /
 * spend-cap-only red posts a low-urgency payload; any app-bug posts a loud one. The webhook is
 * optional under the human-watched regression model: a red run with no webhook returns
 * `{ posted: false, reason: "unconfigured" }` (the caller logs a warning and still exits red — the
 * job status carries the redness, and the report is in the artifacts), and only a CONFIGURED but
 * failed delivery — a non-2xx response, a network error, or a timed-out abort — throws
 * `alert delivery failed` so a dropped red fails loudly rather than vanishing. Every payload string
 * is scrubbed again at this boundary.
 */
export async function postAlert(report: RunReport, config: AlertConfig): Promise<AlertResult> {
  const color = runColor(report);
  if (color === "green") {
    return { posted: false, reason: "green" };
  }
  const hasWebhook = config.webhookUrl !== undefined && config.webhookUrl.length > 0;
  if (!hasWebhook) {
    return { posted: false, reason: "unconfigured" };
  }
  const urgency: Urgency = color === "app" ? "loud" : "low";
  const payload = buildPayload(report, urgency, config.scrub);
  const signal = config.makeSignal?.() ?? AbortSignal.timeout(DEFAULT_ALERT_TIMEOUT_MS);
  let response: AlertResponse;
  try {
    response = await config.fetchImpl(config.webhookUrl ?? "", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal
    });
  } catch {
    throw new AlertDeliveryError("alert delivery failed");
  }
  if (!response.ok) {
    throw new AlertDeliveryError("alert delivery failed");
  }
  return { posted: true, urgency };
}
