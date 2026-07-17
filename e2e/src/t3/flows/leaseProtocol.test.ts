import { describe, expect, it } from "vitest";
import { protocolMatchesTicker, selectLeaseProtocol } from "./leaseProtocol.js";

const CONFIGS: Record<string, unknown> = {
  "OSMOSIS-OSMOSIS-ATOM": { downpayment_ranges: { ATOM: { min: "45.0" } } },
  "OSMOSIS-OSMOSIS-USDC_NOBLE": { downpayment_ranges: { USDC_NOBLE: { min: "40.0" } } },
  "NEUTRON-ASTROPORT-USDC_AXELAR": { downpayment_ranges: { USDC_AXELAR: { min: "40.0" } } }
};

function loaderFrom(configs: Record<string, unknown>): (protocol: string) => Promise<unknown> {
  return (protocol) => {
    if (!(protocol in configs)) {
      return Promise.reject(new Error(`config fetch failed for ${protocol}`));
    }
    return Promise.resolve(configs[protocol]);
  };
}

describe("protocolMatchesTicker", () => {
  it("matches the ticker case-insensitively anywhere in the identifier", () => {
    expect(protocolMatchesTicker("OSMOSIS-OSMOSIS-USDC_NOBLE", "usdc")).toBe(true);
    expect(protocolMatchesTicker("OSMOSIS-OSMOSIS-ATOM", "USDC")).toBe(false);
  });
});

describe("selectLeaseProtocol", () => {
  it("picks the first USDC-named protocol whose config carries a matching downpayment range", async () => {
    const protocol = await selectLeaseProtocol({
      protocols: ["OSMOSIS-OSMOSIS-ATOM", "OSMOSIS-OSMOSIS-USDC_NOBLE", "NEUTRON-ASTROPORT-USDC_AXELAR"],
      downpaymentTicker: "USDC",
      loadConfig: loaderFrom(CONFIGS)
    });
    expect(protocol).toBe("OSMOSIS-OSMOSIS-USDC_NOBLE");
  });

  it("skips a USDC-named protocol whose config fetch fails and falls through to the next", async () => {
    const protocol = await selectLeaseProtocol({
      protocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE", "NEUTRON-ASTROPORT-USDC_AXELAR"],
      downpaymentTicker: "USDC",
      loadConfig: loaderFrom({ "NEUTRON-ASTROPORT-USDC_AXELAR": CONFIGS["NEUTRON-ASTROPORT-USDC_AXELAR"] })
    });
    expect(protocol).toBe("NEUTRON-ASTROPORT-USDC_AXELAR");
  });

  it("skips a USDC-named protocol whose config lacks a USDC downpayment range", async () => {
    const protocol = await selectLeaseProtocol({
      protocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE", "NEUTRON-ASTROPORT-USDC_AXELAR"],
      downpaymentTicker: "USDC",
      loadConfig: loaderFrom({
        "OSMOSIS-OSMOSIS-USDC_NOBLE": { downpayment_ranges: { ATOM: { min: "45.0" } } },
        "NEUTRON-ASTROPORT-USDC_AXELAR": CONFIGS["NEUTRON-ASTROPORT-USDC_AXELAR"]
      })
    });
    expect(protocol).toBe("NEUTRON-ASTROPORT-USDC_AXELAR");
  });

  it("throws a clear error when a USDC-named protocol qualifies for none", async () => {
    await expect(
      selectLeaseProtocol({
        protocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE"],
        downpaymentTicker: "USDC",
        loadConfig: loaderFrom({ "OSMOSIS-OSMOSIS-USDC_NOBLE": { downpayment_ranges: { ATOM: { min: "45.0" } } } })
      })
    ).rejects.toThrow(/no lease protocol with a USDC downpayment range.*tried/s);
  });

  it("throws without a tried-list when no protocol even names the ticker", async () => {
    await expect(
      selectLeaseProtocol({
        protocols: ["OSMOSIS-OSMOSIS-ATOM"],
        downpaymentTicker: "USDC",
        loadConfig: loaderFrom(CONFIGS)
      })
    ).rejects.toThrow(/no lease protocol with a USDC downpayment range among \[OSMOSIS-OSMOSIS-ATOM\]/);
  });
});
