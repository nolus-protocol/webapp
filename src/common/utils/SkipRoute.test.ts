import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SkipRouter } from "./SkipRoute";
import type { SkipMsg } from "@/common/api/types/swap";
import { BackendApi } from "@/common/api";
import { fetchNetworkStatus } from "./ConfigService";

vi.mock("@/common/api", () => ({
  BackendApi: {
    getSkipChains: vi.fn(),
    getSkipRoute: vi.fn(),
    getSkipMessages: vi.fn(),
    getSkipStatus: vi.fn(),
    trackSkipTransaction: vi.fn()
  }
}));

vi.mock("./ConfigService", () => ({
  fetchNetworkStatus: vi.fn()
}));

vi.mock("@/i18n", () => ({
  i18n: { t: (k: string) => k }
}));

// Test getTx returns a properly constructed message for each supported type
// and that MsgExecuteContract (the C1 regression) now builds instead of throwing.

describe("SkipRouter.getTx", () => {
  it("builds MsgTransfer from IBC transfer message", () => {
    const msg: SkipMsg = {
      msg_type_url: "/ibc.applications.transfer.v1.MsgTransfer",
      msg: "" // not used by getTx — it receives pre-parsed msgJSON
    };
    const msgJSON = {
      source_port: "transfer",
      source_channel: "channel-0",
      sender: "nolus1abc",
      receiver: "osmo1xyz",
      token: { denom: "uusdc", amount: "1000000" },
      timeout_timestamp: "123456789"
    };
    const result = SkipRouter.getTx(msg, msgJSON);
    expect(result).toBeDefined();
    expect(result).toMatchObject({
      sourcePort: "transfer",
      sourceChannel: "channel-0",
      sender: "nolus1abc",
      receiver: "osmo1xyz"
    });
  });

  it("builds MsgSend from bank send message", () => {
    const msg: SkipMsg = {
      msg_type_url: "/cosmos.bank.v1beta1.MsgSend",
      msg: ""
    };
    const msgJSON = {
      from_address: "nolus1abc",
      to_address: "nolus1xyz",
      amount: [{ denom: "unls", amount: "1000000" }]
    };
    const result = SkipRouter.getTx(msg, msgJSON);
    expect(result).toMatchObject({
      fromAddress: "nolus1abc",
      toAddress: "nolus1xyz"
    });
  });

  it("builds MsgExecuteContract with object msg (regression for C1)", () => {
    const msg: SkipMsg = {
      msg_type_url: "/cosmwasm.wasm.v1.MsgExecuteContract",
      msg: ""
    };
    const msgJSON = {
      sender: "nolus1abc",
      contract: "nolus1contract",
      msg: { swap: { token_out_denom: "uusdc", amount: "1000000" } },
      funds: [{ denom: "unls", amount: "500" }]
    };
    // Before the C1 fix, this threw Error("message.tx-action-not-supported")
    expect(() => SkipRouter.getTx(msg, msgJSON)).not.toThrow();
    const result = SkipRouter.getTx(msg, msgJSON) as any;
    expect(result.sender).toBe("nolus1abc");
    expect(result.contract).toBe("nolus1contract");
    expect(result.msg).toBeInstanceOf(Uint8Array);
    expect(result.msg.length).toBeGreaterThan(0);
    // Verify bytes decode back to original JSON
    const decoded = JSON.parse(new TextDecoder().decode(result.msg));
    expect(decoded).toEqual({ swap: { token_out_denom: "uusdc", amount: "1000000" } });
    expect(result.funds).toEqual([{ denom: "unls", amount: "500" }]);
  });

  it("builds MsgExecuteContract with base64-encoded msg string", () => {
    const innerMsg = { swap: { token_out_denom: "uusdc" } };
    const encoded = Buffer.from(JSON.stringify(innerMsg)).toString("base64");
    const msg: SkipMsg = {
      msg_type_url: "/cosmwasm.wasm.v1.MsgExecuteContract",
      msg: ""
    };
    const msgJSON = {
      sender: "nolus1abc",
      contract: "nolus1contract",
      msg: encoded,
      funds: []
    };
    const result = SkipRouter.getTx(msg, msgJSON) as any;
    expect(result.msg).toBeInstanceOf(Uint8Array);
    const decoded = JSON.parse(new TextDecoder().decode(result.msg));
    expect(decoded).toEqual(innerMsg);
  });

  it("throws for unsupported msg_type_url", () => {
    const msg: SkipMsg = {
      msg_type_url: "/some.unknown.v1.Msg" as any,
      msg: ""
    };
    expect(() => SkipRouter.getTx(msg, {})).toThrow();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["number", 42],
    ["boolean", true]
  ])("throws when MsgExecuteContract msg is %s (no silent empty-bytes fallback)", (_label, badMsg) => {
    const msg: SkipMsg = {
      msg_type_url: "/cosmwasm.wasm.v1.MsgExecuteContract",
      msg: ""
    };
    const msgJSON = {
      sender: "nolus1abc",
      contract: "nolus1contract",
      msg: badMsg,
      funds: []
    };
    expect(() => SkipRouter.getTx(msg, msgJSON)).toThrow(/unexpected msg type/);
  });
});

describe("SkipRouter.getRoute — revert flag is always set to true on the response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Preload the static chainId to avoid the network-status fetch during getClient()
    (fetchNetworkStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { node_info: { network: "nolus-1" } }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets route.revert = true even when the backend omits it", async () => {
    (BackendApi.getSkipRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      chain_ids: [],
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    });
    const route = await SkipRouter.getRoute("a", "b", "1", false, "c1", "c2");
    expect(route.revert).toBe(true);
  });

  it("forces revert=true even when revert=true was passed (path sets amount_out)", async () => {
    (BackendApi.getSkipRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      chain_ids: [],
      operations: [],
      revert: false, // backend says false — we MUST override to true
      amount_in: "1",
      amount_out: "1",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    });
    const route = await SkipRouter.getRoute("a", "b", "1", true);
    expect(route.revert).toBe(true);
    const req = (BackendApi.getSkipRoute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.amount_out).toBe("1");
    expect(req.amount_in).toBeUndefined();
  });

  it("sends amount_in when revert=false", async () => {
    (BackendApi.getSkipRoute as ReturnType<typeof vi.fn>).mockResolvedValue({
      chain_ids: [],
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    });
    await SkipRouter.getRoute("a", "b", "10", false);
    const req = (BackendApi.getSkipRoute as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.amount_in).toBe("10");
    expect(req.amount_out).toBeUndefined();
  });
});

describe("SkipRouter.submitRoute / transaction()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mkWallet(address: string) {
    return {
      address,
      simulateMultiTx: vi.fn().mockResolvedValue({
        txHash: "deadbeef",
        txBytes: new Uint8Array([1, 2, 3]),
        usedFee: {}
      })
    };
  }

  it("invokes simulateMultiTx per tx and callback with (txData, wallet, chainId)", async () => {
    const wNolus = mkWallet("nolus1a");
    const wOsmo = mkWallet("osmo1a");

    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      txs: [
        {
          cosmos_tx: {
            chain_id: "osmosis-1",
            msgs: [
              {
                msg_type_url: "/cosmos.bank.v1beta1.MsgSend",
                msg: JSON.stringify({
                  from_address: "osmo1a",
                  to_address: "osmo1b",
                  amount: [{ denom: "uosmo", amount: "1" }]
                })
              }
            ]
          }
        }
      ]
    });

    const callback = vi.fn().mockResolvedValue(undefined);
    const route = {
      chain_ids: ["osmosis-1"],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };

    await SkipRouter.submitRoute(
      route as unknown as Parameters<typeof SkipRouter.submitRoute>[0],
      { "nolus-1": wNolus, "osmosis-1": wOsmo } as unknown as Parameters<typeof SkipRouter.submitRoute>[1],
      callback
    );

    expect(wOsmo.simulateMultiTx).toHaveBeenCalledTimes(1);
    const msgs = wOsmo.simulateMultiTx.mock.calls[0][0];
    expect(msgs[0].msgTypeUrl).toBe("/cosmos.bank.v1beta1.MsgSend");
    expect(msgs[0].msg.fromAddress).toBe("osmo1a");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][1]).toBe(wOsmo);
    expect(callback.mock.calls[0][2]).toBe("osmosis-1");
  });

  it("when route.revert=true passes amount_in/amount_out from the route as-is", async () => {
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({ txs: [] });
    const route = {
      chain_ids: [],
      revert: true,
      operations: [],
      amount_in: "IN",
      amount_out: "OUT",
      source_asset_denom: "SRC",
      dest_asset_denom: "DST",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    await SkipRouter.submitRoute(route as unknown as Parameters<typeof SkipRouter.submitRoute>[0], {}, vi.fn());
    const req = (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.amount_in).toBe("IN");
    expect(req.amount_out).toBe("OUT");
  });

  it("builds address_list in route.chain_ids order", async () => {
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({ txs: [] });
    const route = {
      chain_ids: ["nolus-1", "osmosis-1"],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    const nolus = mkWallet("nolus1X");
    const osmo = mkWallet("osmo1X");
    await SkipRouter.submitRoute(
      route as unknown as Parameters<typeof SkipRouter.submitRoute>[0],
      { "nolus-1": nolus, "osmosis-1": osmo } as unknown as Parameters<typeof SkipRouter.submitRoute>[1],
      vi.fn()
    );
    const req = (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(req.address_list).toEqual(["nolus1X", "osmo1X"]);
  });

  it("handles MsgTransfer in the response", async () => {
    const w = mkWallet("nolus1a");
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      txs: [
        {
          cosmos_tx: {
            chain_id: "nolus-1",
            msgs: [
              {
                msg_type_url: "/ibc.applications.transfer.v1.MsgTransfer",
                msg: JSON.stringify({
                  source_port: "transfer",
                  source_channel: "channel-0",
                  sender: "nolus1a",
                  receiver: "osmo1b",
                  token: { denom: "unls", amount: "1" },
                  timeout_timestamp: "1"
                })
              }
            ]
          }
        }
      ]
    });
    const route = {
      chain_ids: ["nolus-1"],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    await SkipRouter.submitRoute(
      route as unknown as Parameters<typeof SkipRouter.submitRoute>[0],
      { "nolus-1": w } as unknown as Parameters<typeof SkipRouter.submitRoute>[1],
      vi.fn()
    );
    const msg = w.simulateMultiTx.mock.calls[0][0][0];
    expect(msg.msgTypeUrl).toBe("/ibc.applications.transfer.v1.MsgTransfer");
    expect(msg.msg.sourceChannel).toBe("channel-0");
  });

  it("propagates wallet.simulateMultiTx errors (no silent swallow)", async () => {
    const w = {
      address: "nolus1a",
      simulateMultiTx: vi.fn().mockRejectedValue(new Error("sim failed"))
    };
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      txs: [
        {
          cosmos_tx: {
            chain_id: "nolus-1",
            msgs: [
              {
                msg_type_url: "/cosmos.bank.v1beta1.MsgSend",
                msg: JSON.stringify({ from_address: "a", to_address: "b", amount: [] })
              }
            ]
          }
        }
      ]
    });
    const route = {
      chain_ids: ["nolus-1"],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    await expect(
      SkipRouter.submitRoute(
        route as unknown as Parameters<typeof SkipRouter.submitRoute>[0],
        { "nolus-1": w } as unknown as Parameters<typeof SkipRouter.submitRoute>[1],
        vi.fn()
      )
    ).rejects.toThrow(/sim failed/);
  });

  it("callback errors propagate (don't swallow user callback failures)", async () => {
    const w = mkWallet("nolus1a");
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({
      txs: [
        {
          cosmos_tx: {
            chain_id: "nolus-1",
            msgs: [
              {
                msg_type_url: "/cosmos.bank.v1beta1.MsgSend",
                msg: JSON.stringify({ from_address: "a", to_address: "b", amount: [] })
              }
            ]
          }
        }
      ]
    });
    const route = {
      chain_ids: ["nolus-1"],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    await expect(
      SkipRouter.submitRoute(
        route as unknown as Parameters<typeof SkipRouter.submitRoute>[0],
        { "nolus-1": w } as unknown as Parameters<typeof SkipRouter.submitRoute>[1],
        vi.fn().mockRejectedValue(new Error("cb boom"))
      )
    ).rejects.toThrow(/cb boom/);
  });

  it("handles empty txs list (no wallet calls)", async () => {
    (BackendApi.getSkipMessages as ReturnType<typeof vi.fn>).mockResolvedValue({ txs: [] });
    const route = {
      chain_ids: [],
      revert: true,
      operations: [],
      amount_in: "1",
      amount_out: "2",
      source_asset_denom: "a",
      dest_asset_denom: "b",
      source_asset_chain_id: "c1",
      dest_asset_chain_id: "c2"
    };
    const cb = vi.fn();
    await SkipRouter.submitRoute(route as unknown as Parameters<typeof SkipRouter.submitRoute>[0], {}, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("SkipRouter.fetchStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns status on STATE_COMPLETED_SUCCESS", async () => {
    (BackendApi.getSkipStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "STATE_COMPLETED_SUCCESS",
      error: ""
    });
    const res = await SkipRouter.fetchStatus("hash", "chain");
    expect(res.state).toBe("STATE_COMPLETED_SUCCESS");
  });

  it("throws on STATE_ABANDONED", async () => {
    (BackendApi.getSkipStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "STATE_ABANDONED",
      error: ""
    });
    await expect(SkipRouter.fetchStatus("h", "c")).rejects.toThrow();
  });

  it("throws on STATE_COMPLETED_ERROR", async () => {
    (BackendApi.getSkipStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "STATE_COMPLETED_ERROR",
      error: ""
    });
    await expect(SkipRouter.fetchStatus("h", "c")).rejects.toThrow();
  });

  it("throws when the backend returns an error string", async () => {
    (BackendApi.getSkipStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "STATE_PENDING",
      error: "rate limited"
    });
    await expect(SkipRouter.fetchStatus("h", "c")).rejects.toBe("rate limited");
  });
});
