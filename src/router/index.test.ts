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
});
