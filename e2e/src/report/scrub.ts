import { sanitizeRpc } from "../transfer.js";

export const REDACTED = "<redacted>";

/**
 * Build a text redactor for everything that reaches a report, a rendered summary, or an alert
 * payload. It strips each provided secret literal (the resolver-target host, and in CI the run
 * mnemonics) and then runs `sanitizeRpc` for bare IPv4[:port] and `user:pass@` credential forms.
 * The value-moving suite resolves the public base domain to an internal address, so neither that
 * host nor a wallet secret may leave in an artifact even if a raw error text carries it. The pass
 * is idempotent, so a value already scrubbed at aggregate time survives re-scrubbing at the render
 * and alert boundaries unchanged.
 */
export function makeScrubber(redactValues: readonly string[]): (text: string) => string {
  const secrets = redactValues.filter((value) => value.length > 0);
  return (text) => {
    let out = text;
    for (const secret of secrets) {
      out = out.split(secret).join(REDACTED);
    }
    return sanitizeRpc(out, "");
  };
}
