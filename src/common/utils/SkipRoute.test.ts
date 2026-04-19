import { describe, it, expect } from "vitest";
import { SkipRouter } from "./SkipRoute";
import type { SkipMsg } from "@/common/api/types/swap";

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
