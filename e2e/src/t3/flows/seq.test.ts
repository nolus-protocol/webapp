import { describe, expect, it } from "vitest";
import { createSeqAllocator, highestIntentSeq, seqAllocatorFromJournal } from "./seq.js";
import { buildIntent, buildOutcome } from "../journal.js";

function intent(seq: number) {
  return buildIntent({
    seq,
    ts: "2026-07-17T12:00:00.000Z",
    spec: "flow",
    walletRole: "primary",
    action: "native-send",
    denoms: [],
    rpcUrl: ""
  });
}

describe("highestIntentSeq", () => {
  it("returns 0 for an empty journal", () => {
    expect(highestIntentSeq([])).toBe(0);
  });

  it("returns the maximum intent seq and ignores outcome records", () => {
    const records = [
      intent(1),
      intent(4),
      buildOutcome({ seq: 9, ts: "2026-07-17T12:00:01.000Z", status: "committed", rpcUrl: "" })
    ];
    expect(highestIntentSeq(records)).toBe(4);
  });
});

describe("createSeqAllocator", () => {
  it("issues a monotonically increasing sequence from the start", () => {
    const alloc = createSeqAllocator(3);
    expect(alloc.peek()).toBe(3);
    expect(alloc.next()).toBe(3);
    expect(alloc.next()).toBe(4);
    expect(alloc.peek()).toBe(5);
  });

  it("rejects a non-positive or non-integer start", () => {
    expect(() => createSeqAllocator(0)).toThrow(/positive integer/);
    expect(() => createSeqAllocator(1.5)).toThrow(/positive integer/);
  });
});

describe("seqAllocatorFromJournal", () => {
  it("seeds one past the highest journaled intent so a resumed run never collides", () => {
    const alloc = seqAllocatorFromJournal([intent(2), intent(7)]);
    expect(alloc.next()).toBe(8);
  });

  it("starts at 1 for an empty journal", () => {
    expect(seqAllocatorFromJournal([]).next()).toBe(1);
  });
});
