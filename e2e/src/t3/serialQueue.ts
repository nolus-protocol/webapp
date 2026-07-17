export type SubmissionKind = "spend" | "redelegate" | "read";
export type BucketName = "strict" | "standard";

export interface BucketConfig {
  ratePerSecond: number;
  burst: number;
}

/** The nginx strict bucket for `/api/swap/*`: 2 RPS, burst 5, shared across the whole suite. */
export const STRICT_BUCKET: BucketConfig = { ratePerSecond: 2, burst: 5 };
/** The standard per-client-IP bucket: 20 RPS, burst 50. All suite egress shares one instance. */
export const STANDARD_BUCKET: BucketConfig = { ratePerSecond: 20, burst: 50 };

export interface SerialQueueDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  strict?: BucketConfig;
  standard?: BucketConfig;
}

/**
 * A submission's `execute` MUST resolve only once the transaction has committed
 * (DeliverTx / block commit), never on the mere broadcast ack. The queue releases a wallet's
 * slot the instant `execute`'s returned promise settles, so resolving early would let a second
 * submission for the same wallet sign against a not-yet-committed account sequence.
 */
export interface SubmitOptions<T> {
  walletKey: string;
  kind: SubmissionKind;
  bucket?: BucketName;
  execute: () => Promise<T>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** A refilling token bucket. Deterministic under an injected clock + sleep for unit tests. */
class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly config: BucketConfig,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>
  ) {
    this.tokens = config.burst;
    this.last = now();
  }

  private refill(): void {
    const at = this.now();
    const elapsedSec = (at - this.last) / 1000;
    if (elapsedSec <= 0) {
      return;
    }
    this.tokens = Math.min(this.config.burst, this.tokens + elapsedSec * this.config.ratePerSecond);
    this.last = at;
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const deficit = 1 - this.tokens;
      await this.sleep(Math.ceil((deficit / this.config.ratePerSecond) * 1000));
    }
  }
}

/**
 * A per-wallet async FIFO. At most one submission per wallet key is ever in flight; the next
 * only begins after the previous submission's `execute` promise settles (commit or throw).
 * Redelegations additionally serialize against each other across every wallet — Cosmos forbids
 * a delegator holding two concurrent redelegations. Every start is gated on a shared token
 * bucket so submissions and API reads (via `pace`) draw from one rate budget, matching the
 * single nginx bucket the suite is billed against.
 */
export class SerialQueue {
  private readonly strict: TokenBucket;
  private readonly standard: TokenBucket;
  private readonly walletTails = new Map<string, Promise<unknown>>();
  private redelegateTail: Promise<unknown> = Promise.resolve();

  constructor(deps: SerialQueueDeps = {}) {
    const now = deps.now ?? ((): number => Date.now());
    const sleep = deps.sleep ?? defaultSleep;
    this.strict = new TokenBucket(deps.strict ?? STRICT_BUCKET, now, sleep);
    this.standard = new TokenBucket(deps.standard ?? STANDARD_BUCKET, now, sleep);
  }

  /** Consume one token from the named bucket, awaiting a refill if the bucket is empty. */
  async pace(bucket: BucketName = "standard"): Promise<void> {
    await (bucket === "strict" ? this.strict : this.standard).take();
  }

  submit<T>(options: SubmitOptions<T>): Promise<T> {
    const prior = this.walletTails.get(options.walletKey) ?? Promise.resolve();
    const guards = options.kind === "redelegate" ? [prior, this.redelegateTail] : [prior];
    const result = this.runAfter(guards, options.bucket ?? "standard", options.execute);
    const tail = result.then(swallow, swallow);
    this.walletTails.set(options.walletKey, tail);
    if (options.kind === "redelegate") {
      this.redelegateTail = tail;
    }
    return result;
  }

  private async runAfter<T>(guards: Promise<unknown>[], bucket: BucketName, execute: () => Promise<T>): Promise<T> {
    await Promise.allSettled(guards);
    await this.pace(bucket);
    return execute();
  }
}

const swallow = (): void => undefined;
