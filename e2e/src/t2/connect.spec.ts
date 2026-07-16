import { test, expect } from "./support.js";
import type { Page, Request } from "@playwright/test";
import type { AminoSignResponse, StdSignDoc } from "@cosmjs/amino";
import { Agent } from "undici";
import type { Dispatcher } from "undici";
import { parseT1Config, parseT2Config } from "../config.js";
import { createUndiciConnector } from "../resolver.js";
import { getJson } from "../http.js";
import { createWalletIdentity, verifyAminoSignature } from "../signer.js";
import { buildKeplrInitScript, buildSignAminoScript, isKeplrExpression, lastChainIdExpression } from "./keplr.js";

interface WalletLabels {
  connect: string;
  keplr: string;
  disconnect: string;
}

interface AddressTruncation {
  front: number;
  back: number;
}

const APP_SHELL_TIMEOUT = 20000;
const CONNECT_TIMEOUT = 30000;
const MECHANISM_KEY = "wallet_connect_mechanism";
const PUBKEY_KEY = "wallet_pubkey";
const EXTENSION_MECHANISM = "extension";
const NETWORK_LABEL = "Nolus";

let labels: WalletLabels;
let dispatcher: Dispatcher | undefined;

function readMessage(locale: unknown, key: string): string {
  if (typeof locale !== "object" || locale === null) throw new Error("locale payload is not an object");
  const message = (locale as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) throw new Error("locale payload has no message map");
  const value = (message as Record<string, unknown>)[key];
  if (typeof value !== "string") throw new Error(`locale message "${key}" is missing`);
  return value;
}

test.beforeAll(async () => {
  const parsed = parseT1Config(process.env);
  if (!parsed.ok) throw new Error(`E2E T2 config error: ${parsed.errors.join("; ")}`);
  const origin = parsed.config.baseUrl.replace(/\/$/, "");
  dispatcher =
    parsed.config.hostOverrides.size > 0
      ? new Agent({ connect: createUndiciConnector(parsed.config.hostOverrides) })
      : undefined;
  const locale = await getJson(`${origin}/api/locales/en`, dispatcher);
  labels = {
    connect: readMessage(locale, "connect-wallet"),
    keplr: readMessage(locale, "keplr"),
    disconnect: readMessage(locale, "disconnect")
  };
});

test.afterAll(async () => {
  if (dispatcher !== undefined) await dispatcher.close();
});

function truncateAddress(address: string, { front, back }: AddressTruncation): string {
  return `${address.substring(0, front)}...${address.substring(address.length - back)}`;
}

async function waitForAppShell(page: Page): Promise<void> {
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: APP_SHELL_TIMEOUT });
}

async function connectKeplr(page: Page): Promise<void> {
  await page.getByRole("button", { name: labels.connect, exact: true }).click();
  await page.getByRole("button", { name: labels.keplr, exact: true }).click();
}

async function assertConnected(page: Page, address: string): Promise<void> {
  const shortName = truncateAddress(address, { front: 8, back: 4 });
  await expect(page.getByRole("button", { name: shortName, exact: true })).toBeVisible({ timeout: CONNECT_TIMEOUT });
  const mechanism = await page.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(MECHANISM_KEY)})`);
  expect(mechanism).toBe(EXTENSION_MECHANISM);
}

function bankSendDoc(chainId: string, address: string): StdSignDoc {
  return {
    chain_id: chainId,
    account_number: "12",
    sequence: "0",
    fee: { amount: [{ denom: "unls", amount: "500" }], gas: "200000" },
    msgs: [
      {
        type: "cosmos-sdk/MsgSend",
        value: { from_address: address, to_address: address, amount: [{ denom: "unls", amount: "1000" }] }
      }
    ],
    memo: "e2e-keplr-stub"
  };
}

function threeWordWindows(mnemonic: string): string[] {
  const words = mnemonic.trim().split(/\s+/);
  const windows: string[] = [];
  for (let i = 0; i + 3 <= words.length; i++) {
    windows.push(words.slice(i, i + 3).join(" "));
  }
  return windows;
}

test.describe("scripted keplr connect", () => {
  test("connects through the real UI without an identity marker", async ({ page, budget, wallet }) => {
    budget.route = "/";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);

    const marker = await page.evaluate<unknown>(isKeplrExpression);
    expect(marker, "the stub must not expose an isKeplr identity marker (#155)").toBeUndefined();

    await connectKeplr(page);
    await assertConnected(page, wallet.address);
  });

  test("signs an amino doc locally with a valid secp256k1 signature", async ({ page, budget, wallet }, testInfo) => {
    budget.route = "/";
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) throw new Error("T2 project is missing baseURL");
    const apiHost = new URL(baseURL).host;

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);
    const balancesSettled = page.waitForResponse((resp) => resp.url().includes("/api/balances"), {
      timeout: CONNECT_TIMEOUT
    });
    await connectKeplr(page);
    await assertConnected(page, wallet.address);
    await balancesSettled;

    const chainId = await page.evaluate<string>(lastChainIdExpression);
    expect(chainId.length).toBeGreaterThan(0);
    const signDoc = bankSendDoc(chainId, wallet.address);

    let popupOpened = false;
    page.on("popup", () => (popupOpened = true));
    const signRequests: string[] = [];
    const onRequest = (req: Request): void => {
      // Only non-GET same-origin traffic is relevant: a broadcast/sign call would be a
      // POST, whereas GETs here are unrelated background polling (prices/balances).
      if (req.method() === "GET") return;
      const url = new URL(req.url());
      if (url.host === apiHost && url.pathname.startsWith("/api/")) signRequests.push(url.pathname);
    };
    page.on("request", onRequest);

    const response = await page.evaluate<AminoSignResponse>(buildSignAminoScript(wallet.address, signDoc));

    page.off("request", onRequest);

    expect(response.signed).toEqual(signDoc);
    expect(response.signature.pub_key.value).toBe(wallet.pubkeyBase64);
    expect(verifyAminoSignature(response)).toBe(true);
    expect(popupOpened, "signing must not open a popup").toBe(false);
    expect(signRequests, "signing must not trigger a non-GET same-origin API request").toEqual([]);
  });

  test("disconnects through the UI and clears wallet storage", async ({ page, budget, wallet }) => {
    budget.route = "/";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);
    await connectKeplr(page);
    await assertConnected(page, wallet.address);

    await page
      .getByRole("button", { name: truncateAddress(wallet.address, { front: 8, back: 4 }), exact: true })
      .click();
    const accountCard = page.locator("div.bg-neutral-bg-1").filter({ hasText: NETWORK_LABEL });
    await accountCard.getByRole("button").last().click();
    await page.getByRole("button", { name: labels.disconnect, exact: true }).click();

    await expect(page.getByRole("button", { name: labels.connect, exact: true })).toBeVisible({
      timeout: CONNECT_TIMEOUT
    });
    const mechanism = await page.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(MECHANISM_KEY)})`);
    const pubkey = await page.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(PUBKEY_KEY)})`);
    expect(mechanism).toBeNull();
    expect(pubkey).toBeNull();
  });

  test("leaks no mnemonic fragment into the page, console, or init script", async ({ page, budget, wallet }) => {
    budget.route = "/";
    const consoleLines: string[] = [];
    page.on("console", (msg) => consoleLines.push(msg.text()));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);
    await connectKeplr(page);
    await assertConnected(page, wallet.address);

    const parsed = parseT2Config(process.env);
    if (!parsed.ok) throw new Error("T2 config unexpectedly invalid inside spec");
    const windows = threeWordWindows(parsed.config.primaryMnemonic);
    const pageContent = await page.content();
    const initScript = buildKeplrInitScript();

    const inConsole = windows.some((w) => consoleLines.join("\n").includes(w));
    const inPage = windows.some((w) => pageContent.includes(w));
    const inScript = windows.some((w) => initScript.includes(w));
    expect(inConsole, "a 3-word mnemonic window appeared in console output").toBe(false);
    expect(inPage, "a 3-word mnemonic window appeared in page content").toBe(false);
    expect(inScript, "a 3-word mnemonic window appeared in the init-script source").toBe(false);
  });
});

test.describe("secondary identity", () => {
  test.use({ walletIdentity: "secondary" });

  test("connects the distinct fallback identity", async ({ page, budget, wallet }) => {
    budget.route = "/";
    const parsed = parseT2Config(process.env);
    if (!parsed.ok) throw new Error("T2 config unexpectedly invalid inside spec");
    const primary = await createWalletIdentity(parsed.config.primaryMnemonic);
    expect(wallet.address).not.toBe(primary.address);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);
    await connectKeplr(page);
    await assertConnected(page, wallet.address);
    await expect(
      page.getByRole("button", { name: truncateAddress(primary.address, { front: 8, back: 4 }), exact: true })
    ).toHaveCount(0);
  });
});
