import type { Page, Locator } from "@playwright/test";
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

/**
 * Click a one-shot control located by an arbitrary Locator (for an unnamed icon like the jailed-row
 * refresh SvgIcon, which has no accessible name) and settle on the terminal surface.
 */
export async function clickLocatorAndSettle(
  page: Page,
  control: Locator,
  label: string,
  terminalMs: number
): Promise<void> {
  await control.first().click({ timeout: terminalMs });
  await awaitTerminal(page, label, terminalMs);
}

export interface CurrencyVariantSelection {
  /** The AdvancedFormControl `id` (e.g. "receive-send", "swap-1"), carried on both the amount
   * `<input>` and the picker's `role=combobox` trigger. NOT unique page-wide — "receive-send" is
   * shared by SupplyForm and WithdrawForm — so every locator here is scoped to the open dialog. */
  fieldId: string;
  /** Search term filtering the option list — matched against the option `value` (the LPN key,
   * e.g. "USDC_NOBLE@osmosis-noble") or `ibcData`, so a resolver ticker or bank denom both work. */
  search: string;
  /** A substring the trigger's label must contain once selected (the shortName family, e.g. "USDC"
   * / "NLS") — proof the pick landed on the intended asset, not the zero-balance default. */
  expectContains: string;
  /**
   * Which side of the trade this picker feeds. A `source` picker (earn supply, earn withdraw, swap
   * From) spends a balance, so its pick is verified by the balance beside the trigger polling
   * positive — that also guards the balances-load timing gap (the app recomputes amount validation
   * only on input, so typing before the balance loads sticks a stale error). A `destination` picker
   * (swap To) receives, and the To block renders NO Balance span at all, so a balance poll would
   * hang forever and eat the test budget; a destination pick is verified by the trigger ticker ONLY.
   * (The round-1 reviewer prescribed exactly this source/destination split; adopting it here.)
   */
  side: "source" | "destination";
}

const CURRENCY_SEARCH_INPUT = "#input-search-input";
// Bound every picker action to a few seconds so a miss surfaces as the loud selection error in
// seconds — a picker failure must never consume the whole (120s) test budget the way an unbounded
// wait against a mis-targeted control did (earn hung 360s on the BTC default).
const PICKER_ACTION_MS = 5000;
const BALANCE_POLL_MS = 10000;

/** The numeric balance the picker shows beside its trigger (customLabel "0.05 USDC"), 0 when none. */
async function pickerBalance(balance: Locator): Promise<number> {
  const text = await balance.innerText().catch(() => "");
  const match = text.replace(/[\s,]/g, "").match(/-?\d+(\.\d+)?/);
  return match === null ? 0 : Number(match[0]);
}

/**
 * Select a funded currency variant in an AdvancedFormControl currency picker before typing, so the
 * amount validates against a real balance, not the zero-balance default option. Per the
 * web-components source the picker's trigger is a `role=combobox` button carrying the field id; it
 * opens a Teleport-portaled searchable `role=listbox` of AssetItem rows filtered on `option.value`
 * / `ibcData` / label. So: open the combobox, filter the search to the variant, click the first
 * filtered row, then VERIFY the pick landed — the trigger must show the expected asset family, and a
 * `source` picker's balance must additionally read positive (see {@link CurrencyVariantSelection.side}).
 * Every locator is scoped to the open dialog (the field id is not page-unique) and every action is
 * time-bounded. Retries the whole open→pick once, then FAILS LOUDLY: a pick that didn't take must
 * never let a spec type into the wrong (or zero) asset.
 */
export async function selectCurrencyVariant(page: Page, selection: CurrencyVariantSelection): Promise<void> {
  const { fieldId, search, expectContains, side } = selection;
  // The trigger and its balance live inside the open dialog; the search box and option list are
  // Teleported to <body>, so those stay page-level (only the open dropdown renders them).
  const dialog = page.locator("#dialog-scroll").last();
  const combobox = dialog.locator(`button[role="combobox"]#${fieldId}`);
  const balance = combobox
    .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " flex-col ")][1]')
    .locator("span.text-typography-link")
    .first();
  const searchInput = page.locator(CURRENCY_SEARCH_INPUT);
  const listbox = page.getByRole("listbox");

  for (let attempt = 0; attempt < 2; attempt++) {
    await combobox.click({ timeout: PICKER_ACTION_MS }).catch(() => undefined);
    await searchInput.fill(search, { timeout: PICKER_ACTION_MS }).catch(() => undefined);
    await listbox
      .locator("li")
      .first()
      .click({ timeout: PICKER_ACTION_MS })
      .catch(() => undefined);
    try {
      await expect(combobox).toContainText(new RegExp(expectContains, "i"), { timeout: PICKER_ACTION_MS });
      if (side === "source") {
        await expect.poll(() => pickerBalance(balance), { timeout: BALANCE_POLL_MS }).toBeGreaterThan(0);
      }
      return;
    } catch {
      // Selection did not land (default still showing, or balance not yet positive) — re-pick once.
    }
  }
  const balanceNote = side === "source" ? " with a positive balance" : "";
  throw new Error(
    `currency variant "${search}" not selected in "${fieldId}": the picker never showed ${expectContains}${balanceNote}`
  );
}

/** Open a position/lease detail dialog by its on-chain address and wait for the dialog to render. */
export async function openDetailDialog(page: Page, address: string, timeoutMs: number): Promise<string> {
  await page.getByText(address, { exact: false }).first().click({ timeout: timeoutMs });
  const dialog = page.locator("#dialog-scroll").first();
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  return dialog.innerText();
}
