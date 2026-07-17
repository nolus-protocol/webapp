/**
 * Shared DOM readers for the fixture-mode UI specs (browser glue, excluded from coverage).
 * The headline figures render through `AnimateNumber`, which exposes the formatted number
 * (no currency symbol) on an `aria-label`; the "$" and sign are separate static nodes.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "../fixtures/support.js";
import { readFixture } from "../fixtures/loader.js";

const STABLE_TIMEOUT = 15000;

/** Resolve a live-locale `message.*` value from the committed en fixture. */
export function fixtureLabel(key: string): string {
  const locale = readFixture("common/locales-en.json") as { message?: Record<string, unknown> };
  const value = locale.message?.[key];
  if (typeof value !== "string") {
    throw new Error(`fixture locale message "${key}" is missing`);
  }
  return value;
}

/** The AnimateNumber container for a labelled figure (the `div.label` sibling group). */
export function figureContainer(page: Page, label: string): Locator {
  return page.locator("div.label", { hasText: label }).locator("xpath=..").locator("div.items-center.gap-2").first();
}

/** Read an AnimateNumber aria-label once it stabilizes across two reads. */
export async function readStableAria(container: Locator): Promise<string> {
  const holder = container.locator("[aria-label]").first();
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = ((await holder.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
        const stable = current.length > 0 && current === previous;
        previous = current;
        return stable;
      },
      { message: "the AnimateNumber aria-label should stabilize", timeout: STABLE_TIMEOUT }
    )
    .toBe(true);
  return previous;
}
