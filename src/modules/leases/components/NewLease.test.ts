import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const hoisted = vi.hoisted(() => {
  const routerPush = vi.fn();
  const routeRef = { meta: { action: "long" } };
  return { routerPush, routeRef };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
  return {
    ...actual,
    useRouter: () => ({ push: hoisted.routerPush }),
    useRoute: () => hoisted.routeRef
  };
});

vi.mock("@/router", () => ({
  RouteNames: { LEASES: "leases" }
}));

vi.mock("web-components", () => ({
  Button: {
    name: "Button",
    props: ["icon", "severity", "size"],
    emits: ["click"],
    template: '<button data-test="back-btn" @click="$emit(\'click\')"></button>'
  }
}));

import { mount } from "@vue/test-utils";
import NewLease from "./NewLease.vue";

function factory() {
  return mount(NewLease, {
    global: {
      mocks: { $t: (k: string) => k },
      stubs: { "router-view": { template: "<div data-test='router-view' />" } }
    }
  });
}

describe("NewLease.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    hoisted.routeRef.meta.action = "long";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing", () => {
    const wrapper = factory();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it("renders a back button that navigates to the leases index", async () => {
    const wrapper = factory();
    const back = wrapper.find('[data-test="back-btn"]');
    expect(back.exists()).toBe(true);
    await back.trigger("click");
    expect(hoisted.routerPush).toHaveBeenCalledWith({ path: "/leases" });
    wrapper.unmount();
  });

  it("renders a router-view slot for the child form", () => {
    const wrapper = factory();
    expect(wrapper.find('[data-test="router-view"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("reflects the action from the current route meta (long)", () => {
    const wrapper = factory();
    expect(wrapper.text()).toContain("message.long");
    wrapper.unmount();
  });

  it("reflects the action from the current route meta (short)", () => {
    hoisted.routeRef.meta.action = "short";
    const wrapper = factory();
    expect(wrapper.text()).toContain("message.short");
    wrapper.unmount();
  });
});
