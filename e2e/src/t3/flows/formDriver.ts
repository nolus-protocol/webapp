import type { Page } from "@playwright/test";
import { expect } from "../../t2/support.js";
import { decideTerminal } from "./terminalSignal.js";
import type { TerminalDecision, TerminalSurface } from "./terminalSignal.js";

// Browser glue (coverage-excluded, see vitest.config.ts). The value-moving forms (lease
// open/repay/close, earn supply/withdraw, stake delegate/undelegate) run `walletOperation` DIRECTLY
// on the footer click — the app has NO confirmation dialog. So the terminal signal is a success
// toast (or an inline error), never a second confirm click. The decision over the observed surfaces
// is the pure, unit-tested `decideTerminal`; this module only reads the surfaces and polls.

const TOAST = "div.toast";
const ERROR = "div.text-typography-error";
// A DEDICATED confirm control only — never the footer submit labels (delegate / supply / repay /
// close-btn-label / submit-btn / open-position), so a settle re-click can never double-submit a
// governed tx under retries:0. Present only for a hypothetical future confirm dialog.
const CONFIRM = /^confirm$|^approve$|^proceed$/i;

export interface SubmitOptions {
  submitLabel: string;
  terminalMs: number;
}

async function readSurface(page: Page): Promise<TerminalSurface> {
  const error = page.locator(ERROR).first();
  const [toastVisible, errorVisible, confirmVisible] = await Promise.all([
    page
      .locator(TOAST)
      .first()
      .isVisible()
      .catch(() => false),
    error.isVisible().catch(() => false),
    page
      .getByRole("button", { name: CONFIRM })
      .first()
      .isVisible()
      .catch(() => false)
  ]);
  const errorText = errorVisible ? await error.innerText().catch(() => "") : "";
  return { toastVisible, errorVisible, errorText, confirmVisible };
}

/**
 * Settle on the app's terminal surface after an action has been triggered: a success toast resolves,
 * an inline error throws its text (sanitized upstream), a timeout throws `terminal-signal-timeout`
 * (a broadcast may have committed underneath — reconciliation catches it). The winning decision is
 * captured INSIDE the poll so an auto-dismissing toast can never be re-read as an error.
 */
async function awaitTerminal(page: Page, label: string, terminalMs: number): Promise<void> {
  let settled: TerminalDecision | undefined;
  try {
    await expect
      .poll(
        async () => {
          const decision = decideTerminal(await readSurface(page));
          if (decision.kind === "click-confirm") {
            await page
              .getByRole("button", { name: CONFIRM })
              .first()
              .click()
              .catch(() => undefined);
            return "pending";
          }
          settled = decision;
          return decision.kind;
        },
        { message: `"${label}" should reach a terminal surface`, timeout: terminalMs }
      )
      .not.toBe("pending");
  } catch (error) {
    // Relabel ONLY the poll's own timeout; rethrow a genuine harness/selector error unchanged.
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out/i.test(message)) {
      throw new Error(`terminal-signal-timeout: no toast or error surface after "${label}"`, { cause: error });
    }
    throw error;
  }
  if (settled?.kind === "error") {
    throw new Error(`form submission failed: ${settled.text}`);
  }
}

/**
 * Wait for a just-typed amount to validate CLEANLY before submitting. The AdvancedFormControl emits
 * on the keyup path and intermediate states ("0.", "0.0") transiently set the inline error; clicking
 * submit before that clears made the driver read a stale "Invalid amount" while `walletOperation`
 * ran against the settled value. Polling for a clear error surface settles the reactive validation.
 */
export async function waitForAmountAccepted(page: Page, timeoutMs = 10000): Promise<void> {
  await expect
    .poll(
      async () => {
        const error = page.locator(ERROR).first();
        if (!(await error.isVisible().catch(() => false))) {
          return "";
        }
        return (await error.innerText().catch(() => "")).trim();
      },
      { message: "the typed amount should validate cleanly before submit", timeout: timeoutMs }
    )
    .toBe("");
}

/**
 * Click a form's footer submit and settle on the terminal surface. The footer submit is `.last()`
 * because a dialog tab can share the submit label (the disambiguation validation.spec documents).
 */
export async function submitForm(page: Page, options: SubmitOptions): Promise<void> {
  await page.getByRole("button", { name: options.submitLabel, exact: true }).last().click();
  await awaitTerminal(page, options.submitLabel, options.terminalMs);
}

/**
 * Click a one-shot action control (e.g. the per-row RedelegateButton, which runs `walletOperation`
 * directly on click with no amount input or dialog) and settle on the terminal surface.
 */
export async function clickActionAndSettle(page: Page, name: RegExp, terminalMs: number): Promise<void> {
  await page.getByRole("button", { name }).first().click({ timeout: terminalMs });
  await awaitTerminal(page, name.source, terminalMs);
}

/** Open a position/lease detail dialog by its on-chain address and wait for the dialog to render. */
export async function openDetailDialog(page: Page, address: string, timeoutMs: number): Promise<string> {
  await page.getByText(address, { exact: false }).first().click({ timeout: timeoutMs });
  const dialog = page.locator("#dialog-scroll").first();
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  return dialog.innerText();
}
