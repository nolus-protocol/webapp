import { describe, it, expect } from "vitest";
import { assertRouteResponse, assertMessagesResponse, assertChainList } from "./skipResponseGuards";

const validRoute = () => ({
  amount_in: "100",
  amount_out: "99",
  source_asset_denom: "uatom",
  dest_asset_denom: "uosmo",
  source_asset_chain_id: "cosmoshub-4",
  dest_asset_chain_id: "osmosis-1",
  chain_ids: ["osmosis-1"],
  operations: [{}]
});

describe("assertRouteResponse", () => {
  it("passes a well-formed route response", () => {
    expect(() => assertRouteResponse(validRoute())).not.toThrow();
  });

  it("throws when a required string field is missing", () => {
    const { amount_in: _amount_in, ...rest } = validRoute();
    expect(() => assertRouteResponse(rest)).toThrow();
  });

  it("throws when chain_ids is not an array", () => {
    expect(() => assertRouteResponse({ ...validRoute(), chain_ids: "osmosis-1" })).toThrow();
  });

  it("throws when a chain-id field consumed by the swap flow is missing", () => {
    const { source_asset_chain_id: _src, ...rest } = validRoute();
    expect(() => assertRouteResponse(rest)).toThrow();
  });

  it("throws on null or non-object input", () => {
    expect(() => assertRouteResponse(null)).toThrow();
    expect(() => assertRouteResponse("nope")).toThrow();
  });
});

describe("assertMessagesResponse", () => {
  it("passes when txs is an array (including empty)", () => {
    expect(() => assertMessagesResponse({ txs: [] })).not.toThrow();
    expect(() => assertMessagesResponse({ txs: [{ cosmos_tx: { chain_id: "osmosis-1", msgs: [] } }] })).not.toThrow();
  });

  it("throws when txs is missing or not an array", () => {
    expect(() => assertMessagesResponse({})).toThrow();
    expect(() => assertMessagesResponse({ txs: "x" })).toThrow();
  });
});

describe("assertChainList", () => {
  it("passes a list of chains with string chain_id + chain_name (and an empty list)", () => {
    expect(() => assertChainList([{ chain_id: "osmosis-1", chain_name: "osmosis" }])).not.toThrow();
    expect(() => assertChainList([])).not.toThrow();
  });

  it("throws when an item lacks a string chain_id", () => {
    expect(() => assertChainList([{ chain_name: "osmosis" }])).toThrow();
  });

  it("throws when an item lacks chain_name (dereferenced by the swap flow)", () => {
    expect(() => assertChainList([{ chain_id: "osmosis-1" }])).toThrow();
  });

  it("throws when the value is not an array", () => {
    expect(() => assertChainList({})).toThrow();
  });
});
