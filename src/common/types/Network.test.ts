import { describe, it, expect } from "vitest";
import { ChainType } from "@/common/types/Network";

// ChainType must gain the `svm` variant to reconcile with
// WalletTypes.svm and drive the getNetworkData()/validateAddress dispatch.
// (The `NetworkInfo` TS mirror in @/common/api/types/config.ts already types
//  `chain_type` as `string`, so it accepts "svm" with no change — the svm
//  discriminator lives in ChainType, which is what these tests pin.)
describe("ChainType (svm)", () => {
  it('includes the svm variant mapped to the string "svm"', () => {
    expect(ChainType.svm).toBe("svm");
  });

  it("keeps the existing cosmos variant unchanged", () => {
    expect(ChainType.cosmos).toBe("cosmos");
  });
});
