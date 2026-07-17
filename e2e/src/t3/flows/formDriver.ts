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
 * Click a form's footer submit and settle DIRECTLY on the app's terminal surface: a success toast
 * resolves, an inline error throws with its text (sanitized upstream). Because the app has no
 * confirmation dialog, this makes no unconditional second click — it only clicks a dedicated
 * confirm button if a future dialog adds one, then keeps racing. A timeout with neither surface
 * throws `terminal-signal-timeout` (a broadcast may have committed underneath — reconciliation
 * catches the ambiguity), never a false success. This keeps committed-vs-failed in the journal
 * matched to chain reality.
 */
export async function submitForm(page: Page, options: SubmitOptions): Promise<void> {
  await page.getByRole("button", { name: options.submitLabel, exact: true }).last().click();
  // Capture the winning decision INSIDE the poll — once `success` is observed nothing may override
  // it (no post-poll re-read, which would be a TOCTOU over the auto-dismissing toast).
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
        { message: `submit "${options.submitLabel}" should reach a terminal surface`, timeout: options.terminalMs }
      )
      .not.toBe("pending");
  } catch (error) {
    // Relabel ONLY the poll's own timeout; rethrow a genuine harness/selector error unchanged.
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out/i.test(message)) {
      throw new Error(`terminal-signal-timeout: no toast or error surface after submitting "${options.submitLabel}"`, {
        cause: error
      });
    }
    throw error;
  }
  if (settled?.kind === "error") {
    throw new Error(`form submission failed: ${settled.text}`);
  }
}

/** Open a position/lease detail dialog by its on-chain address and wait for the dialog to render. */
export async function openDetailDialog(page: Page, address: string, timeoutMs: number): Promise<string> {
  await page.getByText(address, { exact: false }).first().click({ timeout: timeoutMs });
  const dialog = page.locator("#dialog-scroll").first();
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  return dialog.innerText();
}
