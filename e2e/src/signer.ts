import { createRequire } from "node:module";
import type { AccountData, AminoSignResponse, StdSignDoc } from "@cosmjs/amino";

// Minimal typed views over the cosmjs surface this module uses. See the createRequire
// note below for why the modules are loaded, not imported; casting the loaded value to a
// hand-declared interface keeps every call fully typed without an `import()` annotation.
type SignatureHandle = object;

interface OfflineWallet {
  getAccounts(): Promise<readonly AccountData[]>;
  signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse>;
}

interface AminoLib {
  Secp256k1HdWallet: { fromMnemonic(mnemonic: string, options: { prefix: string }): Promise<OfflineWallet> };
  serializeSignDoc(signDoc: StdSignDoc): Uint8Array;
}

interface CryptoLib {
  sha256(data: Uint8Array): Uint8Array;
  Secp256k1Signature: { fromFixedLength(data: Uint8Array): SignatureHandle };
  Secp256k1: { verifySignature(signature: SignatureHandle, messageHash: Uint8Array, pubkey: Uint8Array): boolean };
}

interface EncodingLib {
  toBase64(data: Uint8Array): string;
  fromBase64(encoded: string): Uint8Array;
}

// Playwright (pinned 1.61) installs a require-hook that cannot interop cosmjs's CJS
// build with the ESM-only `@scure/base` it depends on, so a static `import` of any
// cosmjs package aborts the T2 browser run at collection time. A native `createRequire`
// sidesteps that hook and loads the real modules; the same path works under vitest, so
// this file stays usable by both runners without a second code path.
const loadModule = createRequire(import.meta.url);
const aminoLib = loadModule("@cosmjs/amino") as AminoLib;
const cryptoLib = loadModule("@cosmjs/crypto") as CryptoLib;
const encodingLib = loadModule("@cosmjs/encoding") as EncodingLib;

const NOLUS_PREFIX = "nolus";

/**
 * Bech32 prefixes for the chain ids the scripted wallet can present an account on. The
 * app's cross-chain swap path (`useSwapForm.ts` `getWallets`) builds one wallet per chain
 * id in the Skip route and asks the provider for that chain's account — for the dust
 * USDC->NLS swap the route hops through Osmosis, so `osmosis-1` needs an `osmo1…` address
 * derived from the same key. An unlisted chain id rejects loudly so route drift stays a
 * visible failure instead of a mis-prefixed address reaching Skip.
 */
const CHAIN_ID_PREFIXES: Record<string, string> = {
  "pirin-1": NOLUS_PREFIX,
  "osmosis-1": "osmo"
};

/**
 * JSON-safe account shape handed to the in-page stub. A `Uint8Array` cannot survive a
 * Playwright `exposeFunction` boundary, so the public key crosses as base64; the stub
 * decodes it back to bytes in the browser before returning it to the app.
 */
export interface AccountPayload {
  address: string;
  pubkey: string;
  algo: string;
}

/**
 * A wallet identity usable by the scripted Keplr stub. The mnemonic is deliberately
 * not a member of this type: it is captured only inside the closure returned by
 * `createWalletIdentity`, never stored as a property, so neither `JSON.stringify` nor a
 * page-side binding can ever serialize it out of Node.
 */
export interface WalletIdentity {
  readonly address: string;
  readonly pubkeyBase64: string;
  getAccounts(chainId?: string): Promise<AccountPayload>;
  signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse>;
}

async function derivePrefixedAccount(mnemonic: string, prefix: string): Promise<AccountPayload> {
  const prefixedWallet = await aminoLib.Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  const accounts = await prefixedWallet.getAccounts();
  const account = accounts[0];
  if (account === undefined) {
    throw new Error(`derived ${prefix} wallet exposed no account`);
  }
  return { address: account.address, pubkey: encodingLib.toBase64(account.pubkey), algo: account.algo };
}

function makeAccountResolver(mnemonic: string, primary: AccountPayload): (chainId?: string) => Promise<AccountPayload> {
  const payloadsByPrefix = new Map<string, Promise<AccountPayload>>([[NOLUS_PREFIX, Promise.resolve(primary)]]);
  return (chainId?: string): Promise<AccountPayload> => {
    const prefix =
      chainId === undefined
        ? NOLUS_PREFIX
        : Object.hasOwn(CHAIN_ID_PREFIXES, chainId)
          ? CHAIN_ID_PREFIXES[chainId]
          : undefined;
    if (prefix === undefined) {
      return Promise.reject(new Error(`no bech32 prefix mapped for chain id "${chainId}"`));
    }
    const cached = payloadsByPrefix.get(prefix);
    if (cached !== undefined) {
      return cached;
    }
    const derived = derivePrefixedAccount(mnemonic, prefix);
    payloadsByPrefix.set(prefix, derived);
    derived.catch(() => payloadsByPrefix.delete(prefix));
    return derived;
  };
}

export async function createWalletIdentity(mnemonic: string): Promise<WalletIdentity> {
  const wallet = await aminoLib.Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: NOLUS_PREFIX });
  const accounts = await wallet.getAccounts();
  const account = accounts[0];
  if (account === undefined) {
    throw new Error("derived wallet exposed no account");
  }
  const address = account.address;
  const pubkeyBase64 = encodingLib.toBase64(account.pubkey);
  const algo = account.algo;

  return {
    address,
    pubkeyBase64,
    getAccounts: makeAccountResolver(mnemonic, { address, pubkey: pubkeyBase64, algo }),
    // Signing stays bound to the nolus account on purpose: the T3 spend journal and
    // per-denom caps only account for Nolus-side transactions, so a foreign-chain sign
    // attempt must fail loudly (cosmjs rejects an unknown signer address) rather than
    // silently spend outside the caps.
    signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
      return wallet.signAmino(signerAddress, signDoc);
    }
  };
}

/**
 * Verifies a secp256k1 amino signature the way CosmJS's `SigningStargateClient` does:
 * over `sha256(serializeSignDoc(signed))` against the embedded public key. This is the
 * outermost cryptographic seam of the stub — a passing verification proves the signature
 * a real transaction would carry is valid, not merely that a validator accepted a shape.
 */
export function verifyAminoSignature(response: AminoSignResponse): boolean {
  const messageHash = cryptoLib.sha256(aminoLib.serializeSignDoc(response.signed));
  const signature = cryptoLib.Secp256k1Signature.fromFixedLength(encodingLib.fromBase64(response.signature.signature));
  const pubkey = encodingLib.fromBase64(String(response.signature.pub_key.value));
  return cryptoLib.Secp256k1.verifySignature(signature, messageHash, pubkey);
}
