import { describe, it, expect } from "vitest";
import { getIbc } from "./IbcUtils";

describe("IbcUtils.getIbc", () => {
  const IBC_REGEX = /^ibc\/[0-9A-F]{64}$/;

  it("should return 'ibc/' prefix followed by 64-char uppercase hex (68 chars total)", () => {
    const result = getIbc("transfer/channel-0/uatom");
    expect(result).toMatch(IBC_REGEX);
    expect(result).toHaveLength(68);
  });

  it("should be deterministic — same input yields same hash", () => {
    const a = getIbc("transfer/channel-0/uusdc");
    const b = getIbc("transfer/channel-0/uusdc");
    expect(a).toBe(b);
  });

  it("should produce different hashes for different inputs", () => {
    expect(getIbc("a")).not.toBe(getIbc("b"));
  });

  it("should match known Cosmos Hub ATOM IBC denom on channel-0", () => {
    // Well-known fixture: transfer/channel-0/uatom on Cosmos Hub
    expect(getIbc("transfer/channel-0/uatom")).toBe(
      "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
    );
  });

  it("should handle empty string and still return valid format", () => {
    const result = getIbc("");
    expect(result).toMatch(IBC_REGEX);
  });

  it("should handle non-ASCII input and return valid format", () => {
    const result = getIbc("chänñel");
    expect(result).toMatch(IBC_REGEX);
  });

  it("should never lowercase hex output", () => {
    const result = getIbc("transfer/channel-0/uatom");
    const hex = result.slice("ibc/".length);
    expect(hex).toBe(hex.toUpperCase());
    expect(hex).not.toMatch(/[a-f]/);
  });
});
