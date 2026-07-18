import type { Page } from "@playwright/test";
import type { ConnectLabels } from "../t2/appDriver.js";
import { assertConnected, connectKeplr, waitForAppShell } from "../t2/appDriver.js";
import type { RepairCandidate } from "./reconcile.js";

// Browser glue (coverage-excluded, see vitest.config.ts). Orphan-lease repair is performed by
// DRIVING THE APP UI, never by constructing a close transaction here: the production app builds
// every tx client-side via @nolus/nolusjs (a real market-close carries a Skip route + funds),
// and the backend's unsigned-tx endpoints are a phantom surface the app never calls. Repairing
// through the market-close UI therefore exercises the exact production construction path with no
// duplicated tx logic. Live execution is CI-gated; the sweep's classification is unit-tested.

const POSITIONS_ROUTE = "/positions";
const DIALOG_TIMEOUT = 20000;

export interface RepairOutcome {
  address: string;
  attempted: boolean;
  note: string;
}

/** Connect the primary wallet on a light route and land on the positions list. */
async function connectOnPositions(page: Page, labels: ConnectLabels, address: string): Promise<void> {
  await page.goto(POSITIONS_ROUTE, { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, labels);
  await assertConnected(page, address);
}

/** Open the lease's detail dialog by its on-chain address, then start the market-close flow. */
async function openMarketClose(page: Page, leaseAddress: string): Promise<void> {
  await page.getByText(leaseAddress, { exact: false }).first().click({ timeout: DIALOG_TIMEOUT });
  const dialog = page.locator("#dialog-scroll").first();
  await dialog.waitFor({ state: "visible", timeout: DIALOG_TIMEOUT });
  await page.getByRole("button", { name: /close/i }).first().click();
  await page
    .getByRole("button", { name: /market/i })
    .first()
    .click();
}

/**
 * Drive the app's market-close flow for a single orphaned lease, signing through the scripted
 * Keplr stub already installed on `page`. Returns an outcome record for the leftover report; a
 * failure to reach the close or confirm control is surfaced as `attempted: false` so the caller can leave
 * the lease report-only rather than treating a UI miss as a repair.
 */
export async function repairOrphanLease(
  page: Page,
  labels: ConnectLabels,
  primaryAddress: string,
  candidate: RepairCandidate
): Promise<RepairOutcome> {
  await connectOnPositions(page, labels, primaryAddress);
  try {
    await openMarketClose(page, candidate.address);
  } catch {
    return { address: candidate.address, attempted: false, note: "market-close control not reachable" };
  }
  try {
    await page
      .getByRole("button", { name: /confirm|submit|send/i })
      .first()
      .click({ timeout: DIALOG_TIMEOUT });
  } catch {
    return { address: candidate.address, attempted: false, note: "confirm control not reachable" };
  }
  return { address: candidate.address, attempted: true, note: "market-close submitted via app UI" };
}
