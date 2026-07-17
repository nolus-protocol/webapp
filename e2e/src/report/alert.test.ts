import { describe, expect, it } from "vitest";
import type { ClassifiedFailure, RunReport } from "./aggregate.js";
import { AlertDeliveryError, postAlert } from "./alert.js";
import type { AlertFetch, AlertRequest } from "./alert.js";
import { makeScrubber } from "./scrub.js";

function failure(
  failureClass: ClassifiedFailure["failureClass"],
  overrides: Partial<ClassifiedFailure> = {}
): ClassifiedFailure {
  return {
    tier: "t3-flows",
    projectName: "t3-flows",
    test: "t",
    failureClass,
    suiteSuspect: false,
    detail: "d",
    ...overrides
  };
}

function runReport(failures: ClassifiedFailure[]): RunReport {
  return {
    version: 1,
    generatedAt: "2026-07-17T00:00:00.000Z",
    tiers: [
      {
        tier: "t3-flows",
        status: "present",
        total: 1,
        passed: 0,
        failed: failures.length,
        skipped: 0,
        appBug: 0,
        envFlake: 0,
        spendCapAbort: 0
      }
    ],
    failures,
    skips: [],
    journal: { status: "absent", intents: 0, outcomes: 0, unmatchedIntents: 0 },
    leftover: { status: "absent" },
    coverage: { status: "absent", mappedCells: 0, cells: [], gaps: [] }
  };
}

const identity = (text: string): string => text;

function okFetch(): { fetchImpl: AlertFetch; calls: { url: string; request: AlertRequest }[] } {
  const calls: { url: string; request: AlertRequest }[] = [];
  const fetchImpl: AlertFetch = (url, request) => {
    calls.push({ url, request });
    return Promise.resolve({ ok: true, status: 200 });
  };
  return { fetchImpl, calls };
}

describe("postAlert", () => {
  it("posts nothing for a green run", async () => {
    const { fetchImpl, calls } = okFetch();
    const result = await postAlert(runReport([]), { webhookUrl: "https://hook", fetchImpl, scrub: identity });
    expect(result).toEqual({ posted: false, reason: "green" });
    expect(calls).toHaveLength(0);
  });

  it("posts a low-urgency payload for an env-flake-only red", async () => {
    const { fetchImpl, calls } = okFetch();
    const result = await postAlert(runReport([failure("env-flake")]), {
      webhookUrl: "https://hook",
      fetchImpl,
      scrub: identity
    });
    expect(result).toEqual({ posted: true, urgency: "low" });
    expect(JSON.parse(calls[0]?.request.body ?? "{}")).toMatchObject({ urgency: "low", suite: "e2e-regression" });
  });

  it("posts a loud payload when any app-bug is present", async () => {
    const { fetchImpl, calls } = okFetch();
    const result = await postAlert(runReport([failure("env-flake"), failure("app-bug")]), {
      webhookUrl: "https://hook",
      fetchImpl,
      scrub: identity
    });
    expect(result).toEqual({ posted: true, urgency: "loud" });
    expect(JSON.parse(calls[0]?.request.body ?? "{}")).toMatchObject({ urgency: "loud" });
  });

  it("throws when the webhook responds non-2xx", async () => {
    const fetchImpl: AlertFetch = () => Promise.resolve({ ok: false, status: 503 });
    await expect(
      postAlert(runReport([failure("app-bug")]), { webhookUrl: "https://hook", fetchImpl, scrub: identity })
    ).rejects.toBeInstanceOf(AlertDeliveryError);
  });

  it("throws alert delivery failed when the network request rejects", async () => {
    const fetchImpl: AlertFetch = () => Promise.reject(new Error("ECONNRESET"));
    await expect(
      postAlert(runReport([failure("app-bug")]), { webhookUrl: "https://hook", fetchImpl, scrub: identity })
    ).rejects.toThrow("alert delivery failed");
  });

  it("fails fast down the delivery-failed path when the request signal aborts", async () => {
    // A black-hole webhook that only ever settles when the abort signal fires; the injected
    // already-aborted signal stands in for a fired timeout, so the test needs no clock or sleep.
    const fetchImpl: AlertFetch = (_url, request) =>
      new Promise<never>((_resolve, reject) => {
        if (request.signal.aborted) {
          reject(new Error("aborted"));
          return;
        }
        request.signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    await expect(
      postAlert(runReport([failure("app-bug")]), {
        webhookUrl: "https://hook",
        fetchImpl,
        scrub: identity,
        makeSignal: () => AbortSignal.abort()
      })
    ).rejects.toThrow("alert delivery failed");
  });

  it("reports a red run with no webhook as unconfigured rather than throwing", async () => {
    const { fetchImpl, calls } = okFetch();
    const result = await postAlert(runReport([failure("env-flake")]), {
      webhookUrl: undefined,
      fetchImpl,
      scrub: identity
    });
    expect(result).toEqual({ posted: false, reason: "unconfigured" });
    expect(calls).toHaveLength(0);
  });

  it("stays silent on a green run with no webhook", async () => {
    const { fetchImpl, calls } = okFetch();
    const result = await postAlert(runReport([]), { webhookUrl: "", fetchImpl, scrub: identity });
    expect(result).toEqual({ posted: false, reason: "green" });
    expect(calls).toHaveLength(0);
  });

  it("scrubs every payload string of IP, resolver host and mnemonic", async () => {
    const resolver = "deploy-host.internal";
    const mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const { fetchImpl, calls } = okFetch();
    await postAlert(
      runReport([failure("app-bug", { test: `host 10.1.2.3 ${resolver}`, detail: `boom ${mnemonic}` })]),
      {
        webhookUrl: "https://hook",
        fetchImpl,
        scrub: makeScrubber([resolver, mnemonic])
      }
    );
    const body = calls[0]?.request.body ?? "";
    expect(body).not.toContain("10.1.2.3");
    expect(body).not.toContain(resolver);
    expect(body).not.toContain("abandon ability able");
  });
});
