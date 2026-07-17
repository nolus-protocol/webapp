import { hasDownpaymentRange } from "./preconditions.js";

/** Whether a protocol identifier names the downpayment asset (e.g. contains "USDC"). */
export function protocolMatchesTicker(protocol: string, ticker: string): boolean {
  return protocol.toUpperCase().includes(ticker.toUpperCase());
}

export interface SelectProtocolInput {
  protocols: string[];
  downpaymentTicker: string;
  loadConfig: (protocol: string) => Promise<unknown>;
}

/**
 * Pick, deterministically, the first protocol whose identifier names the downpayment ticker AND
 * whose `/api/leases/config/<protocol>` payload loads and carries a downpayment range for that
 * ticker. `loadConfig` is injected so the selection logic is unit-tested without the network. A
 * protocol whose config fetch fails or lacks the range is skipped; when none qualifies this throws
 * a clear error naming every protocol tried.
 */
export async function selectLeaseProtocol(input: SelectProtocolInput): Promise<string> {
  const candidates = input.protocols.filter((protocol) => protocolMatchesTicker(protocol, input.downpaymentTicker));
  const tried: string[] = [];
  for (const protocol of candidates) {
    let config: unknown;
    try {
      config = await input.loadConfig(protocol);
    } catch {
      tried.push(`${protocol} (config fetch failed)`);
      continue;
    }
    if (hasDownpaymentRange(config, input.downpaymentTicker)) {
      return protocol;
    }
    tried.push(`${protocol} (no ${input.downpaymentTicker} downpayment range)`);
  }
  throw new Error(
    `no lease protocol with a ${input.downpaymentTicker} downpayment range among [${input.protocols.join(", ")}]` +
      (tried.length > 0 ? `; tried: ${tried.join("; ")}` : "")
  );
}
