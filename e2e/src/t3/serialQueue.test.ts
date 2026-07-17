import { describe, expect, it } from "vitest";
import { SerialQueue } from "./serialQueue.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Drain the microtask queue completely — setImmediate fires after every pending microtask. */
function flush(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

const instant = { now: (): number => 0, sleep: (): Promise<void> => Promise.resolve() };

describe("SerialQueue serialization", () => {
  it("runs one submission per wallet at a time; the second starts only after the first settles", async () => {
    const queue = new SerialQueue(instant);
    const started: string[] = [];
    const first = deferred<string>();

    const p1 = queue.submit({
      walletKey: "w",
      kind: "spend",
      execute: () => {
        started.push("a");
        return first.promise;
      }
    });
    const p2 = queue.submit({
      walletKey: "w",
      kind: "spend",
      execute: () => {
        started.push("b");
        return Promise.resolve("b");
      }
    });

    await flush();
    expect(started).toEqual(["a"]);

    first.resolve("a");
    expect(await p1).toBe("a");
    expect(await p2).toBe("b");
    expect(started).toEqual(["a", "b"]);
  });

  it("runs distinct wallets concurrently", async () => {
    const queue = new SerialQueue(instant);
    const started: string[] = [];
    const held = deferred<undefined>();

    const p1 = queue.submit({
      walletKey: "w1",
      kind: "spend",
      execute: async () => {
        started.push("w1");
        await held.promise;
      }
    });
    const p2 = queue.submit({
      walletKey: "w2",
      kind: "spend",
      execute: () => {
        started.push("w2");
        return Promise.resolve();
      }
    });

    await flush();
    expect(started).toEqual(["w1", "w2"]);
    held.resolve(undefined);
    await Promise.all([p1, p2]);
  });

  it("releases the slot even when a submission rejects, letting the next run", async () => {
    const queue = new SerialQueue(instant);
    const p1 = queue.submit({ walletKey: "w", kind: "spend", execute: () => Promise.reject(new Error("boom")) });
    const p2 = queue.submit({ walletKey: "w", kind: "spend", execute: () => Promise.resolve("ok") });
    await expect(p1).rejects.toThrow("boom");
    expect(await p2).toBe("ok");
  });
});

describe("SerialQueue redelegate mutex", () => {
  it("never overlaps two redelegations even across different wallets", async () => {
    const queue = new SerialQueue(instant);
    let concurrent = 0;
    let maxConcurrent = 0;
    const hold = deferred<undefined>();

    const make = (key: string): Promise<void> =>
      queue.submit({
        walletKey: key,
        kind: "redelegate",
        execute: async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          if (key === "w1") {
            await hold.promise;
          }
          concurrent -= 1;
        }
      });

    const p1 = make("w1");
    const p2 = make("w2");
    await flush();
    expect(maxConcurrent).toBe(1);

    hold.resolve(undefined);
    await Promise.all([p1, p2]);
    expect(maxConcurrent).toBe(1);
  });
});

describe("SerialQueue pacing", () => {
  it("waits on a bucket once its burst is exhausted, then refills over time", async () => {
    let clock = 0;
    let slept = 0;
    const queue = new SerialQueue({
      now: () => clock,
      sleep: (ms: number) => {
        clock += ms;
        slept += ms;
        return Promise.resolve();
      },
      strict: { ratePerSecond: 2, burst: 1 }
    });

    await queue.pace("strict");
    expect(slept).toBe(0);
    await queue.pace("strict");
    expect(slept).toBeGreaterThan(0);
  });
});
