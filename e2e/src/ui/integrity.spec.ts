/**
 * Phase 6 integrity, per route (fixture mode, deterministic): key components present, no
 * broken images, no leaked raw i18n keys, interactive controls enabled. Complements the
 * visual baselines with assertions a screenshot cannot make.
 *
 * Assertion labels (coverage matrix): `integrity-shell`, `integrity-no-raw-keys`,
 * `integrity-no-broken-images`, `integrity-interactive` (each per route).
 */

import { test, expect } from "../fixtures/support.js";
import type { Page } from "@playwright/test";

const ROUTES = ["/", "/assets", "/earn", "/positions", "/stake", "/activities", "/vote", "/stats"] as const;

// A rendered string still carrying a `message.<key>` token is a missing translation leaking
// the raw vue-i18n key. Fixture mode never hits the (English, non-i18n) white-screen, so no
// allowlist is needed here — any match is a real leak.
const RAW_KEY = /message\.[a-z0-9-]+/i;

async function assertNoRawKeys(page: Page): Promise<void> {
  const text = await page.locator("#app").innerText();
  const match = RAW_KEY.exec(text);
  expect(match?.[0] ?? null, `raw i18n key leaked into rendered text`).toBeNull();
}

async function assertNoBrokenImages(page: Page): Promise<void> {
  // A broken image is finished loading (`complete`) yet has zero intrinsic width. A still
  // loading image (`complete === false`) is not counted, avoiding a lazy-load false positive.
  const broken = await page
    .locator("#app img")
    .evaluateAll((images) =>
      (images as HTMLImageElement[])
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc)
    );
  expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
}

for (const route of ROUTES) {
  test(`integrity ${route}`, async ({ page, fixtureMode }) => {
    await fixtureMode.boot(page, route); // integrity-shell: reached interactive, not white-screen
    await expect(page.locator("#app button").first()).toBeEnabled(); // integrity-interactive
    await assertNoRawKeys(page); // integrity-no-raw-keys
    await assertNoBrokenImages(page); // integrity-no-broken-images
  });
}
