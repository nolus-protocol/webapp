/**
 * Phase 6 visual regression — FIXTURE MODE ONLY (deterministic data + WS stub). Runs under
 * the four `visual-*` projects (light/dark x desktop/mobile, deviceScaleFactor pinned to 1).
 * LOCAL-ONLY / NON-GATING: CI launches no browsers, so these never run there; the pinned
 * baselines are a local regression aid (see README for the containerized upgrade path).
 *
 * Determinism: reduced-motion is emulated, CSS animations/transitions are frozen, the
 * count-up figures are given a settle window, and the dynamic third-party Intercom widget
 * is blocked. Assertion label (coverage matrix): `visual-<route>` per route.
 */

import { test, expect } from "../fixtures/support.js";

const ROUTES = ["/", "/assets", "/earn", "/positions", "/stake", "/activities", "/vote", "/stats"] as const;

const FREEZE_CSS = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}`;

function routeSlug(route: string): string {
  return route === "/" ? "home" : route.replace(/\//g, "");
}

for (const route of ROUTES) {
  test(`visual ${route}`, async ({ page, fixtureMode }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Block the dynamic third-party support widget so it can't perturb the pixels.
    await page.route(/intercom/i, (route_) => route_.abort());
    await fixtureMode.boot(page, route);
    await page.addStyleTag({ content: FREEZE_CSS });
    // Let the AnimateNumber count-up finish so the digit widths (and surrounding layout)
    // settle before capture.
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot(`${routeSlug(route)}.png`, {
      fullPage: true,
      animations: "disabled",
      scale: "css",
      // The AnimateNumber count-up is a JS (rAF) animation `animations:"disabled"` cannot
      // freeze; its aria-labelled figures are masked. The small maxDiffPixels tolerance
      // absorbs sub-pixel font anti-aliasing noise on the live SPA bundle (observed
      // ~0.01 of pixels) — a real UI change diffs far more. Baselines are LOCAL-ONLY /
      // NON-GATING (CI runs no browsers), so this is a local regression aid, not a gate.
      mask: [page.locator("#app [aria-label]")],
      maxDiffPixels: 800
    });
  });
}
