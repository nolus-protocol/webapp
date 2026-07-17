import { createRequire } from "node:module";
import type { Coin, StdFee } from "@cosmjs/amino";
import { sanitizeRpc } from "./transfer.js";

// Playwright (pinned 1.61) installs a require-hook that cannot interop cosmjs's CJS build
// with the ESM-only `@scure/base` it depends on, so a static `import` of a cosmjs package
// aborts the T2 browser run at collection time. A native `createRequire` sidesteps that
// hook and loads the real modules — the same pattern as `src/signer.ts`. This module is
// network-bound and coverage-excluded (see vitest.config.ts); the pure msg/fee/amount
// construction lives in `src/transfer.ts` and is fully unit-tested.
const loadModule = createRequire(import.meta.url);

interface OfflineAminoSigner {
  getAccounts(): Promise<readonly { address: string }[]>;
}

interface DeliverTxResponse {
  code: number;
  transactionHash: string;
  height: number;
}

interface StargateClient {
  sendTokens(sender: string, recipient: string, amount: Coin[], fee: StdFee, memo: string): Promise<DeliverTxResponse>;
  disconnect(): void;
}

interface AminoLib {
  Secp256k1HdWallet: { fromMnemonic(mnemonic: string, options: { prefix: string }): Promise<OfflineAminoSigner> };
}

interface StargateLib {
  SigningStargateClient: { connectWithSigner(endpoint: string, signer: OfflineAminoSigner): Promise<StargateClient> };
}

const aminoLib = loadModule("@cosmjs/amino") as AminoLib;
const stargateLib = loadModule("@cosmjs/stargate") as StargateLib;

export interface BroadcastSendParams {
  rpcUrl: string;
  senderMnemonic: string;
  prefix: string;
  recipient: string;
  amount: Coin;
  fee: StdFee;
  memo?: string;
}

export interface BroadcastResult {
  txHash: string;
  height: number;
  sender: string;
}

/**
 * Broadcast a single bank send from a mnemonic-derived account. Every failure is rethrown
 * with the RPC endpoint stripped out (see `sanitizeRpc`) so a surfaced error never leaks
 * the host. The client is always disconnected.
 */
export async function broadcastSend(params: BroadcastSendParams): Promise<BroadcastResult> {
  const { rpcUrl, senderMnemonic, prefix, recipient, amount, fee, memo } = params;
  let client: StargateClient | undefined;
  try {
    const signer = await aminoLib.Secp256k1HdWallet.fromMnemonic(senderMnemonic, { prefix });
    const accounts = await signer.getAccounts();
    const sender = accounts[0]?.address;
    if (sender === undefined) {
      throw new Error("sender wallet exposed no account");
    }
    client = await stargateLib.SigningStargateClient.connectWithSigner(rpcUrl, signer);
    const result = await client.sendTokens(sender, recipient, [amount], fee, memo ?? "");
    if (result.code !== 0) {
      throw new Error(`broadcast rejected with code ${result.code}`);
    }
    return { txHash: result.transactionHash, height: result.height, sender };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(sanitizeRpc(raw, rpcUrl), { cause: error });
  } finally {
    client?.disconnect();
  }
}
