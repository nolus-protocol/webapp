import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock every module the router imports so the router module can be loaded
// under jsdom without pulling in hundreds of deps.
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    });
  }
});

const hoisted = vi.hoisted(() => ({
  setLangMock: vi.fn(async () => {}),
  getLanguageMock: vi.fn(() => ({ key: "en" }))
}));

vi.mock("@/i18n", () => ({
  setLang: hoisted.setLangMock
}));

vi.mock("@/common/utils/LanguageUtils", () => ({
  getLanguage: hoisted.getLanguageMock
}));

// Individual route modules — stub to minimal shape createRouter can accept.
const stubRoute = {
  path: "dashboard",
  name: "dashboard",
  component: { template: "<div />" },
  meta: { title: "t", description: "d" }
};

vi.mock("@/modules/dashboard/router", () => ({ DashboardRouter: stubRoute }));
vi.mock("@/modules/earn/router", () => ({ EarnRouter: { ...stubRoute, path: "earn", name: "earn" } }));
vi.mock("@/modules/stats/router", () => ({ StatsRouter: { ...stubRoute, path: "stats", name: "stats" } }));
vi.mock("@/modules/leases/router", () => ({ LeasesRouter: { ...stubRoute, path: "leases", name: "leases" } }));
vi.mock("@/modules/history/router", () => ({ HistoryRouter: { ...stubRoute, path: "history", name: "history" } }));
vi.mock("@/modules/vote/router", () => ({ VoteRouter: { ...stubRoute, path: "vote", name: "vote" } }));
vi.mock("@/modules/assets/router", () => ({ AssetsRouter: { ...stubRoute, path: "assets", name: "assets" } }));
vi.mock("@/modules/stake/router", () => ({ StakeRouter: { ...stubRoute, path: "stake", name: "stake" } }));

vi.mock("@/modules/view.vue", () => ({ default: { name: "MainLayout", template: "<router-view />" } }));

// Force vue-router to use memory history in tests to avoid jsdom/history races.
vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
  return {
    ...actual,
    createWebHistory: actual.createMemoryHistory
  };
});

describe("router/index.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    hoisted.getLanguageMock.mockReturnValue({ key: "en" });
    hoisted.setLangMock.mockResolvedValue(undefined);

    // Ensure DOM has meta[name=description] so beforeEach can update it
    if (!document.querySelector('meta[name="description"]')) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      meta.setAttribute("content", "");
      document.head.appendChild(meta);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("router module loads and exports RouteNames + router instance", async () => {
    const mod = await import("./index");
    expect(mod.router).toBeDefined();
    expect(mod.RouteNames).toBeDefined();
    expect(typeof mod.router.push).toBe("function");
  });

  it("loadLanguage guard resolves getLanguage().key through setLang", async () => {
    hoisted.getLanguageMock.mockReturnValue({ key: "de" });
    const mod = await import("./index");
    // Manually invoke the guard by pushing a known path; memory history starts at /
    const push = mod.router.push("/dashboard");
    await push;
    expect(hoisted.setLangMock).toHaveBeenCalledWith("de");
  });

  it("beforeEach updates document.title and meta description from route meta", async () => {
    const mod = await import("./index");
    await mod.router.push("/dashboard");

    const metaEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    expect(metaEl?.getAttribute("content")).toBe("d");
    expect(document.title).toBe("t");
  });

  it("resolves unknown paths without throwing", async () => {
    const mod = await import("./index");
    // Catch-all redirect to "/" — should complete without rejection
    await expect(mod.router.push("/some/nonexistent/path")).resolves.not.toThrow();
  });

  it("loadLanguage does not hang navigation when setLang rejects", async () => {
    // Regression: a rejecting setLang used to bubble through the guard's
    // bare `await`, so next() was never called and navigation hung silently.
    // The guard must now catch and still call next() so the router resolves.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    hoisted.setLangMock.mockRejectedValueOnce(new Error("locale fetch failed"));

    const mod = await import("./index");

    // If the guard hangs, this push never resolves — give it a finite race.
    const push = mod.router.push("/dashboard");
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("navigation hung")), 1000));
    await expect(Promise.race([push, timeout])).resolves.not.toThrow();

    expect(hoisted.setLangMock).toHaveBeenCalledWith("en");
    expect(consoleErrorSpy).toHaveBeenCalled();
    // Current route should actually be the target — navigation completed.
    expect(mod.router.currentRoute.value.path).toBe("/dashboard");
  });
});

describe("handleChunkLoadError", () => {
  const key = "nolus-chunk-reload-at";

  function makeStorage(initial: Record<string, string> = {}): Storage {
    const store: Record<string, string> = { ...initial };
    return {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      }
    };
  }

  it("reloads on 'Failed to fetch dynamically imported module' error", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    const storage = makeStorage();

    handleChunkLoadError(
      new Error("Failed to fetch dynamically imported module: https://x/assets/SingleLease-abc.js"),
      "/leases/nolus1abc",
      storage,
      1_000_000,
      reload
    );

    expect(reload).toHaveBeenCalledExactlyOnceWith("/leases/nolus1abc");
    expect(storage.getItem(key)).toBe("1000000");
  });

  it("reloads on 'Loading chunk X failed' error", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    handleChunkLoadError(new Error("Loading chunk 42 failed."), "/dashboard", makeStorage(), 1_000_000, reload);
    expect(reload).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });

  it("reloads on 'Importing a module script failed' (Safari)", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    handleChunkLoadError(new Error("Importing a module script failed."), "/earn", makeStorage(), 1_000_000, reload);
    expect(reload).toHaveBeenCalledExactlyOnceWith("/earn");
  });

  it("does not reload for unrelated errors", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    handleChunkLoadError(new Error("Network disconnected"), "/leases", makeStorage(), 1_000_000, reload);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when a reload happened within the last 10 seconds (loop guard)", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    const storage = makeStorage({ [key]: "995000" }); // 5s ago

    handleChunkLoadError(
      new Error("Failed to fetch dynamically imported module: x"),
      "/leases",
      storage,
      1_000_000,
      reload
    );

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads again once the 10s loop-guard window has elapsed", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    const storage = makeStorage({ [key]: "989000" }); // 11s ago

    handleChunkLoadError(
      new Error("Failed to fetch dynamically imported module: x"),
      "/leases",
      storage,
      1_000_000,
      reload
    );

    expect(reload).toHaveBeenCalledExactlyOnceWith("/leases");
  });

  it("falls back to current pathname when no target path is given", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    handleChunkLoadError(
      new Error("Failed to fetch dynamically imported module: x"),
      undefined,
      makeStorage(),
      1_000_000,
      reload
    );
    expect(reload).toHaveBeenCalledExactlyOnceWith(window.location.pathname);
  });

  it("tolerates non-Error values (string / null)", async () => {
    const { handleChunkLoadError } = await import("./index");
    const reload = vi.fn();
    handleChunkLoadError(null, "/leases", makeStorage(), 1_000_000, reload);
    handleChunkLoadError("plain string", "/leases", makeStorage(), 1_000_000, reload);
    expect(reload).not.toHaveBeenCalled();
  });
});
