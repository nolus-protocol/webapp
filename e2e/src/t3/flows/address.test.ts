import { describe, expect, it } from "vitest";
import { reencodeAddress, toOsmosisAddress } from "./address.js";

// A real nolus bech32 address (valid checksum) and its verified osmo re-encoding of the same bytes.
const NOLUS = "nolus10hvz04hh92xzct5hxnpsn5h2fp3p4amm28vhvp";
const OSMO = "osmo10hvz04hh92xzct5hxnpsn5h2fp3p4amm5v0cck";

describe("toOsmosisAddress", () => {
  it("re-encodes a nolus address under the osmo HRP preserving the key bytes", () => {
    expect(toOsmosisAddress(NOLUS)).toBe(OSMO);
  });

  it("round-trips back to the original nolus address", () => {
    expect(reencodeAddress(toOsmosisAddress(NOLUS), "nolus")).toBe(NOLUS);
  });

  it("throws on a malformed bech32 address rather than returning a bad string", () => {
    expect(() => toOsmosisAddress("not-a-bech32-address")).toThrow();
  });
});
