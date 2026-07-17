import { describe, expect, it } from "vitest";
import { makeScrubber, REDACTED } from "./scrub.js";

describe("makeScrubber", () => {
  it("redacts a bare IPv4 with port from a transport error", () => {
    const scrub = makeScrubber([]);
    const out = scrub("connect ECONNREFUSED 10.1.2.3:26657 while broadcasting");
    expect(out).not.toContain("10.1.2.3");
    // sanitizeRpc rewrites a bare IPv4 to its own <rpc> placeholder; literal secrets use REDACTED.
    expect(out).toContain("<rpc>");
  });

  it("replaces a provided secret literal with the REDACTED marker", () => {
    expect(makeScrubber(["secret-host"])("at secret-host now")).toContain(REDACTED);
  });

  it("redacts a provided secret literal and credential userinfo", () => {
    const scrub = makeScrubber(["deploy-host.internal"]);
    const out = scrub("fetch https://user:s3cret@deploy-host.internal/api failed");
    expect(out).not.toContain("deploy-host.internal");
    expect(out).not.toContain("s3cret");
  });

  it("removes a mnemonic passed as a secret literal", () => {
    const mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const scrub = makeScrubber([mnemonic]);
    expect(scrub(`leaked ${mnemonic} in a message`)).not.toContain("abandon ability able");
  });

  it("ignores empty redact values and is idempotent", () => {
    const scrub = makeScrubber(["", "10.9.9.9"]);
    const once = scrub("host 10.9.9.9 unreachable");
    expect(scrub(once)).toBe(once);
    expect(once).not.toContain("10.9.9.9");
  });
});
