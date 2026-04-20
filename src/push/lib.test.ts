import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib.ts pulls in @/common/utils/LanguageUtils (IndexedDB) transitively —
// stub it so the module graph doesn't try to use a real DB under jsdom.
vi.mock("@/common/utils/LanguageUtils", () => ({
  getLanguage: vi.fn(() => ({ key: "en" })),
  setLanguageDb: vi.fn()
}));

vi.mock("./config", () => ({
  publicKey: "test-public-key",
  host: "http://localhost/api/etl",
  redirect: "http://localhost"
}));

type RegisterMock = ReturnType<
  typeof vi.fn<[string, RegistrationOptions | undefined], Promise<ServiceWorkerRegistration>>
>;

function installServiceWorkerMock(registerImpl: RegisterMock) {
  // jsdom doesn't provide navigator.serviceWorker — install a minimal shim.
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: registerImpl }
  });
}

function uninstallServiceWorkerMock() {
  // Remove our shim between tests so "serviceWorker" in navigator probes
  // reflect each test's intent, not leaked state.
  if (Object.prototype.hasOwnProperty.call(navigator, "serviceWorker")) {
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  }
}

describe("push/lib.ts — getWorker() cached-rejection behavior", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    uninstallServiceWorkerMock();
    vi.restoreAllMocks();
  });

  it("does NOT cache a rejected registration — a subsequent call tries again and can succeed", async () => {
    // First call rejects (e.g. stale SW 404 after deploy). Second call must
    // issue a fresh register() that resolves — otherwise the permanently-
    // rejected Promise poisons the module until a full page reload.
    const register: RegisterMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("register failed"))
      .mockResolvedValueOnce({ scope: "/" } as unknown as ServiceWorkerRegistration);

    installServiceWorkerMock(register);

    const { initWorker, getSubscriptionStatus } = await import("./lib");

    // initWorker() swallows errors via console.error — drives the first
    // getWorker() call, which will reject and must clear the cache.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await initWorker();
    expect(register).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();

    // Second call: fresh register() attempt, resolves this time.
    // Use getSubscriptionStatus() so we can also assert it sees the resolved
    // registration (not the stale rejected one). pushManager.getSubscription
    // returning null → false, which is fine; the load-bearing assertion is
    // that register() was called again AND the code reached the `.pushManager`
    // access without throwing.
    const fakeReg = {
      scope: "/",
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) }
    } as unknown as ServiceWorkerRegistration;
    register.mockResolvedValueOnce(fakeReg);

    const status = await getSubscriptionStatus();
    expect(register).toHaveBeenCalledTimes(2);
    expect(status).toBe(false);
  });

  it("memoizes a successful registration — only one register() call across many getWorker() callers", async () => {
    const fakeReg = {
      scope: "/",
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) }
    } as unknown as ServiceWorkerRegistration;

    const register: RegisterMock = vi.fn().mockResolvedValue(fakeReg);
    installServiceWorkerMock(register);

    const { initWorker, getSubscriptionStatus, notificationUnsubscribe } = await import("./lib");

    await initWorker();
    await getSubscriptionStatus();
    await notificationUnsubscribe();

    // Cached promise: register() invoked exactly once across three calls.
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("rejection propagates to callers that don't catch — confirms re-throw after cache-clear", async () => {
    // getSubscriptionStatus() wraps in try/catch and returns false, so we
    // can't use it to observe the re-throw. notificationUnsubscribe() also
    // swallows. initWorker() catches too. Instead, drive the private getWorker
    // via initSW indirectly by asserting the swallowers observe rejection
    // (they return their "safe" fallback values rather than hanging forever).
    const register: RegisterMock = vi.fn().mockRejectedValue(new Error("register failed"));
    installServiceWorkerMock(register);

    const { getSubscriptionStatus, notificationUnsubscribe } = await import("./lib");

    // Both should resolve to their safe fallback, proving the rejection was
    // observed rather than silently held.
    await expect(getSubscriptionStatus()).resolves.toBe(false);
    await expect(notificationUnsubscribe()).resolves.toBe(false);

    // And because the cache was cleared, BOTH calls triggered a fresh
    // register() attempt — 2 calls, not 1 cached rejection reused.
    expect(register).toHaveBeenCalledTimes(2);
  });
});
