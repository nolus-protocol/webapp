import type { Page } from "@playwright/test";
import { expect } from "../../t2/support.js";

// Browser glue (coverage-excluded, see vitest.config.ts). The value-moving submit path is the
// same across the routed forms (lease open/close, earn supply/withdraw, stake delegate/undelegate):
// click the footer submit, confirm in the dialog, and resolve only once the app reaches a terminal
// signal. Passed to the engine as the `execute` closure so a submission settles on commit, not on
// the mere click — matching the SerialQueue's commit-release contract.

const CONFIRM = /confirm|submit|send/i;
const TOAST = "div.toast";

export interface SubmitOptions {
  submitLabel: string;
  terminalMs: number;
}

/**
 * Drive a routed form's footer submit through confirmation and wait for the app's terminal toast.
 * The footer submit is targeted with `.last()` because a dialog tab often shares the submit label
 * (the same disambiguation `validation.spec.ts` documents).
 */
export async function submitForm(page: Page, options: SubmitOptions): Promise<void> {
  await page.getByRole("button", { name: options.submitLabel, exact: true }).last().click();
  await page.getByRole("button", { name: CONFIRM }).first().click({ timeout: options.terminalMs });
  await expect(page.locator(TOAST)).toBeVisible({ timeout: options.terminalMs });
}

/** Open a position/lease detail dialog by its on-chain address and wait for the dialog to render. */
export async function openDetailDialog(page: Page, address: string, timeoutMs: number): Promise<string> {
  await page.getByText(address, { exact: false }).first().click({ timeout: timeoutMs });
  const dialog = page.locator("#dialog-scroll").first();
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  return dialog.innerText();
}
