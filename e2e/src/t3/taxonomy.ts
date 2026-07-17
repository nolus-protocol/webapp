import { sanitizeRpc } from "../transfer.js";

export type FailureCategory = "environment" | "app" | "precondition";

export interface ClassifyInput {
  message?: string;
  status?: number;
  error?: unknown;
  rpcUrl?: string;
}

export interface Classification {
  category: FailureCategory;
  signal: string;
  reason: string;
}

interface Rule {
  category: FailureCategory;
  signal: string;
  matches: (text: string, status: number | undefined) => boolean;
}

interface PatternRule {
  category: FailureCategory;
  signal: string;
  regex: RegExp;
}

function pattern(rule: PatternRule): Rule {
  return { category: rule.category, signal: rule.signal, matches: (text) => rule.regex.test(text) };
}

// Ordered most-specific-first. A precondition (a state the operator must fix) outranks an
// environment blip, which outranks the app-bug default. Liquidity/timing contract rejects are
// environment; every other unrecognized failure — assertions, genuine app error surfaces — is
// an app bug. Rules test the raw (pre-redaction) text so a host/IP-bearing transport error
// still matches; only the stored `reason` is sanitized.
const RULES: Rule[] = [
  pattern({
    category: "precondition",
    signal: "unfunded",
    regex: /unfunded|insufficient funds|not funded|no balance/i
  }),
  pattern({
    category: "precondition",
    signal: "unbonding-entry-cap",
    regex: /too many unbonding|unbonding.*entries|max(imum)? entries/i
  }),
  pattern({
    category: "precondition",
    signal: "redelegation-lock",
    regex: /redelegation.*(in progress|not complete|locked)|receiving redelegation/i
  }),
  pattern({
    category: "precondition",
    signal: "osmosis-side-funds",
    regex: /osmosis.*(funds|balance|liquidity is missing)|missing osmosis/i
  }),
  pattern({
    category: "precondition",
    signal: "lease-amount-range",
    regex:
      /down\s?payment.*(too (small|low|large|high)|below|above|out of range)|lease.*(min|max).*(rejected|exceeded)/i
  }),
  pattern({
    category: "precondition",
    signal: "swap-amount-too-small",
    regex: /amount too small|below.*minimum.*swap|dust.*(no route|not routable)|too small to route/i
  }),
  {
    category: "environment",
    signal: "rate-limited",
    matches: (text, status) => status === 429 || /\b429\b|rate.?limit|too many requests/i.test(text)
  },
  {
    category: "environment",
    signal: "node-unavailable",
    matches: (text, status) =>
      isUpstream5xx(status) ||
      /econnrefused|econnreset|etimedout|enotfound|socket hang up|fetch failed|network error|\b50[234]\b|rpc.*(unavailable|unreachable|error)|node.*(unavailable|unreachable)/i.test(
        text
      )
  },
  pattern({
    category: "environment",
    signal: "relayer-delay",
    regex: /relayer|ibc.*(delay|timeout|pending|not relayed)|packet.*(timeout|pending|not relayed)/i
  }),
  pattern({
    category: "environment",
    signal: "price-move",
    regex: /price.*(move|moved|change|changed|slippage)|slippage|quote.*expired|expired quote|out of tolerance/i
  }),
  pattern({
    category: "environment",
    signal: "liquidity",
    regex: /insufficient liquidity|not enough liquidity|no route|route not found/i
  }),
  pattern({
    category: "environment",
    signal: "chain-state-timeout",
    regex: /timed?\s?out|timeout waiting|deadline exceeded|wait.*(chain|block|commit)/i
  }),
  pattern({
    category: "app",
    signal: "assertion",
    regex: /\bexpect\(|assertion|to(Be|Equal|Contain|Match|HaveScreenshot)\b/i
  })
];

function isUpstream5xx(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504;
}

function textOf(input: ClassifyInput): string {
  if (typeof input.message === "string") {
    return input.message;
  }
  const error = input.error;
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "";
}

/**
 * Classify a failure into environment / app / precondition. The returned `reason` is always
 * run through `sanitizeRpc` so an RPC host, embedded credential, or bare IP can never reach a
 * journal, report, or annotation — even the generic form (an `ECONNREFUSED 1.2.3.4:26657`
 * transport error) is redacted with no target host known.
 */
export function classify(input: ClassifyInput): Classification {
  const raw = textOf(input);
  const reason = sanitizeRpc(raw, input.rpcUrl ?? "");
  for (const rule of RULES) {
    if (rule.matches(raw, input.status)) {
      return { category: rule.category, signal: rule.signal, reason };
    }
  }
  return { category: "app", signal: "unclassified", reason };
}
