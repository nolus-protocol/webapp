import type { Locator } from "@playwright/test";
import { expect } from "../../t2/support.js";
import { normalizeFigure } from "./figureText.js";
import { withinTolerance } from "./tolerance.js";

// Browser glue (coverage-excluded, see vitest.config.ts). Rendered money figures animate via the
// app's AnimateNumber count-up: `innerText` is the whole digit-roller ladder, and the true
// formatted value lives ONLY in the element's `aria-label` (the T1 bridge technique + runbook). The
// pure normalization/comparison lives in `figureText.ts`; this module reads the animated DOM.

const STABLE_TIMEOUT = 20000;

/**
 * Read a single AnimateNumber figure's stabilized value from its `aria-label`, requiring two
 * consecutive equal reads so the count-up animation has settled.
 */
export async function readStableAria(holder: Locator, timeoutMs: number = STABLE_TIMEOUT): Promise<string> {
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = normalizeFigure((await holder.getAttribute("aria-label")) ?? "");
        const stable = current.length > 0 && current === previous;
        previous = current;
        return stable;
      },
      { message: "the AnimateNumber aria-label should stabilize across two reads", timeout: timeoutMs }
    )
    .toBe(true);
  return previous;
}

async function pollForFigure(scope: Locator, timeoutMs: number, matches: (aria: string) => boolean): Promise<boolean> {
  try {
    await expect
      .poll(
        async () => {
          const holders = scope.locator("[aria-label]");
          const count = await holders.count();
          for (let index = 0; index < count; index += 1) {
            if (matches(normalizeFigure((await holders.nth(index).getAttribute("aria-label")) ?? ""))) {
              return true;
            }
          }
          return false;
        },
        { message: "an AnimateNumber aria-label should settle to the oracle value", timeout: timeoutMs }
      )
      .toBe(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether some AnimateNumber figure within `scope` settles to the oracle-expected value — matched on
 * its `aria-label` (never `innerText`), normalized for `$`/comma/whitespace noise. Polling until the
 * value appears absorbs the count-up (only the final frame equals the oracle). The caller asserts
 * the boolean so the cell's own test block carries the `expect`.
 */
export async function findAnimatedFigure(
  scope: Locator,
  expected: string,
  timeoutMs: number = STABLE_TIMEOUT
): Promise<boolean> {
  const want = normalizeFigure(expected);
  return pollForFigure(scope, timeoutMs, (aria) => aria === want);
}

/**
 * Whether some AnimateNumber figure within `scope` settles to a value within `tolerance` of the
 * oracle-expected decimal — matched on its `aria-label`, keeping the tolerance semantics (price can
 * drift between the API snapshot the spec read and the app's live render).
 */
export async function findAnimatedFigureWithinTolerance(
  scope: Locator,
  expected: string,
  tolerance: string,
  timeoutMs: number = STABLE_TIMEOUT
): Promise<boolean> {
  return pollForFigure(
    scope,
    timeoutMs,
    (aria) => /^-?\d+(\.\d+)?$/.test(aria) && withinTolerance({ actual: aria, expected, tolerance }).ok
  );
}

/**
 * Whether some AnimateNumber figure within `scope` settles to a POSITIVE number — matched on its
 * `aria-label`, not the digit-roller `innerText`. Used to confirm a balance figure has loaded and
 * finished counting up (e.g. the swap From-side NLS balance) before typing against it.
 */
export async function findPositiveAnimatedFigure(scope: Locator, timeoutMs: number = STABLE_TIMEOUT): Promise<boolean> {
  return pollForFigure(scope, timeoutMs, (aria) => /^\d+(\.\d+)?$/.test(aria) && Number(aria) > 0);
}
