import { describe, expect, it } from "vitest";
import { heldMicro, microToUsd, parseCurrencyResolver, priceUsdOf, tickersMatching } from "./denomResolver.js";
import { Decimal } from "../../oracle/decimal.js";

// Fixtures shaped like the REAL responses: balances `symbol`/`denom` carry the ibc bank hash and
// `amount_usd` reads ≈0, so identity must come from the resolved bank denom and value from prices.
const CURRENCIES = {
  currencies: {
    "USDC_NOBLE@osmosis-1": {
      key: "USDC_NOBLE@osmosis-1",
      ticker: "USDC_NOBLE",
      symbol: "ibc/USDCHASH",
      bank_symbol: "ibc/USDCHASH",
      decimal_digits: 6
    },
    "OSMO@osmosis-1": {
      key: "OSMO@osmosis-1",
      ticker: "OSMO",
      symbol: "ibc/OSMOHASH",
      bank_symbol: "ibc/OSMOHASH",
      decimal_digits: 6
    },
    "NLS@osmosis-1": { key: "NLS@osmosis-1", ticker: "NLS", symbol: "unls", bank_symbol: "unls", decimal_digits: 6 }
  }
};

const BALANCES = {
  balances: [
    {
      key: "USDC_NOBLE@osmosis-1",
      symbol: "ibc/USDCHASH",
      denom: "ibc/USDCHASH",
      amount: "74577016",
      amount_usd: "0",
      decimal_digits: 6
    },
    { key: "NLS@osmosis-1", symbol: "unls", denom: "unls", amount: "5000000", amount_usd: "0", decimal_digits: 6 }
  ],
  total_value_usd: "0"
};

const PRICES = {
  prices: {
    "USDC_NOBLE@osmosis-1": { key: "USDC_NOBLE@osmosis-1", symbol: "USDC_NOBLE", price_usd: "1.00" },
    "ATOM@osmosis-1": { key: "ATOM@osmosis-1", symbol: "ATOM", price_usd: "1.52" }
  }
};

describe("parseCurrencyResolver", () => {
  it("maps a ticker to its bank denom and decimals from the hash-symbol payload", () => {
    const resolver = parseCurrencyResolver(CURRENCIES);
    expect(resolver.get("USDC_NOBLE")).toEqual({
      ticker: "USDC_NOBLE",
      bankSymbols: ["ibc/USDCHASH"],
      decimalDigits: 6
    });
    expect(resolver.get("NLS")?.bankSymbols).toEqual(["unls"]);
  });
});

describe("heldMicro", () => {
  it("sums balances by resolved bank denom, ignoring symbol and amount_usd", () => {
    const resolver = parseCurrencyResolver(CURRENCIES);
    expect(heldMicro(BALANCES, resolver.get("USDC_NOBLE"))).toBe(74577016n);
    expect(heldMicro(BALANCES, resolver.get("OSMO"))).toBe(0n);
  });

  it("returns 0 for an unresolved asset", () => {
    expect(heldMicro(BALANCES, undefined)).toBe(0n);
  });
});

describe("priceUsdOf / microToUsd", () => {
  it("resolves the USD price by symbol or key ticker", () => {
    expect(priceUsdOf(PRICES, "USDC_NOBLE")?.toString(2)).toBe("1.00");
    expect(priceUsdOf(PRICES, "ATOM")?.toString(2)).toBe("1.52");
    expect(priceUsdOf(PRICES, "UNKNOWN")).toBeUndefined();
  });

  it("values a micro holding as micro/10^decimals × price", () => {
    expect(microToUsd(74577016n, 6, Decimal.fromString("1.00")).toString(2)).toBe("74.57");
    expect(microToUsd(30000000n, 6, Decimal.fromString("1.52")).toString(2)).toBe("45.60");
  });
});

describe("tickersMatching", () => {
  it("finds every ticker variant containing the needle", () => {
    const resolver = new Map(parseCurrencyResolver(CURRENCIES));
    resolver.set("USDC_AXELAR", { ticker: "USDC_AXELAR", bankSymbols: ["ibc/AX"], decimalDigits: 6 });
    expect(tickersMatching(resolver, "usdc").sort()).toEqual(["USDC_AXELAR", "USDC_NOBLE"]);
  });
});
