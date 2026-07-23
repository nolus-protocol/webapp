import { describe, it, expect, afterEach, vi } from "vitest";

// validateAddress lives in a module with a wide dependency graph (wallet stores,
// nolusjs, network authenticators). We only exercise validateAddress, so every
// non-validation dependency is stubbed at its module boundary. `@cosmjs/encoding`
// (fromBech32) is left REAL because bech32 validation is the behaviour under test.
vi.mock("@/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@nolus/nolusjs", () => ({ CurrencyUtils: { convertDenomToMinimalDenom: vi.fn() } }));
vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({ wallet: null }),
  WalletActions: {}
}));
// WalletConnect imports `WalletStorage` from "." (the @/common/utils barrel).
vi.mock("@/common/utils", () => ({ WalletStorage: { getWalletConnectMechanism: () => null } }));
vi.mock("./CurrencyLookup", () => ({ getCurrencyByDenom: vi.fn() }));
vi.mock("@/common/types", () => ({
  WalletConnectMechanism: {
    KEPLR: "KEPLR",
    SOL_PHANTOM: "SOL_PHANTOM",
    SOL_SOLFLARE: "SOL_SOLFLARE",
    LEDGER: "LEDGER",
    LEDGER_BLUETOOTH: "LEDGER_BLUETOOTH"
  }
}));
vi.mock("@/networks", () => ({ authenticateKeplr: vi.fn(), authenticateLedger: vi.fn() }));
vi.mock("@/networks/cosm/WalletFactory", () => ({
  authenticatePhantom: vi.fn(),
  authenticateSolFlare: vi.fn()
}));

import { validateAddress } from "./WalletConnect";
import { ChainType } from "@/common/types/Network";

// The mocked i18n echoes the key, so an invalid address returns this key.
const INVALID = "message.invalid-address";

// A real, checksum-valid bech32 address (a Nolus contract from the fixtures).
const VALID_BECH32 = "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd";

// Base58 vectors generated offline; decoded byte-lengths are exact.
const SOL_32_BYTES = "4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw"; // decodes to 32 bytes
const SOL_31_BYTES = "7DgMXtkS6Hwx6gRuPW2HhmcSJCLK9Fqv8rMVL5uZLQ"; // decodes to 31 bytes
const SOL_33_BYTES = "txeBm6DBJzgRqAfmHrsEPm3BRfCPTWbLgTWqqfPAHaPt"; // decodes to 33 bytes
const NOT_BASE58 = "not_base58_0OIl"; // contains 0/O/I/l — not in the base58 alphabet

afterEach(() => {
  vi.restoreAllMocks();
});

// validateAddress dispatches on the destination network's chain
// type: bech32 for cosmos targets (unchanged), base58/32-byte-pubkey for svm
// targets. New signature: validateAddress(address, chainType?) where a missing
// chainType keeps today's bech32 behaviour (the onSubmitNative cosmos path).
describe("validateAddress — cosmos targets (bech32, unchanged)", () => {
  it("accepts a checksum-valid bech32 address", () => {
    expect(validateAddress(VALID_BECH32, ChainType.cosmos)).toBe("");
  });

  it("rejects a non-bech32 address", () => {
    expect(validateAddress("definitely-not-a-bech32-address", ChainType.cosmos)).toBe(INVALID);
  });

  it("rejects the empty address", () => {
    expect(validateAddress("", ChainType.cosmos)).toBe(INVALID);
  });

  it("defaults to bech32 validation when no chain type is passed", () => {
    expect(validateAddress(VALID_BECH32)).toBe("");
  });
});

describe("validateAddress — svm targets (base58, 32-byte pubkey)", () => {
  it("accepts a valid base58 address that decodes to exactly 32 bytes", () => {
    expect(validateAddress(SOL_32_BYTES, ChainType.svm)).toBe("");
  });

  it("rejects a non-base58 string", () => {
    expect(validateAddress(NOT_BASE58, ChainType.svm)).toBe(INVALID);
  });

  it("rejects a base58 string that decodes to 31 bytes", () => {
    expect(validateAddress(SOL_31_BYTES, ChainType.svm)).toBe(INVALID);
  });

  it("rejects a base58 string that decodes to 33 bytes", () => {
    expect(validateAddress(SOL_33_BYTES, ChainType.svm)).toBe(INVALID);
  });

  it("does not accept a bech32 address for an svm target", () => {
    expect(validateAddress(VALID_BECH32, ChainType.svm)).toBe(INVALID);
  });
});
