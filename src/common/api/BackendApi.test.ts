import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackendApiClient } from "./BackendApi";
import { ApiError } from "./types/common";
import { jsonResponse, emptyResponse, malformedErrorResponse } from "../__fixtures__/fetchResponses";

// These tests exercise the `BackendApiClient` transport layer:
//   * doFetch success, schema validation, 429 debouncing, non-429 errors,
//     and the 204 empty-body special case.
//   * request() coalescing of parallel GETs to the same URL.
//
// Only `global.fetch` is mocked. Internal helpers (request/doFetch) are tested
// via public methods: `getPrices()` for schema-guarded GETs, `getEarnStats()`
// for an unguarded GET, `getLeaseQuote()` for POSTs, and `trackSkipTransaction`
// for POST cache-exclusion.

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// A minimal valid PricesResponse that passes PricesResponseSchema.
const validPricesPayload = () => ({
  prices: {
    USDC: { key: "USDC", symbol: "USDC", price_usd: "1.0001" }
  },
  updated_at: "2026-04-19T00:00:00Z"
});

describe("BackendApi", () => {
  describe("doFetch - success", () => {
    it("should return parsed body on 2xx", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse(validPricesPayload()));

      const result = await api.getPrices();
      expect(result.USDC).toEqual({ price: "1.0001", symbol: "USDC" });
    });

    it("should call fetch with expected URL and GET method", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse(validPricesPayload()));

      await api.getPrices();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toContain("/api/prices");
      expect(calledInit?.method).toBe("GET");
    });

    it("should send query params on GET with params", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          balances: [],
          total_value_usd: "0"
        })
      );

      await api.getBalances("nolus1abc");
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toContain("address=nolus1abc");
    });

    it("should send body on POST", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

      await api.trackSkipTransaction("osmosis-1", "0xdeadbeef");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0][1];
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeDefined();
      const parsed = JSON.parse(init?.body as string);
      expect(parsed).toEqual({ chain_id: "osmosis-1", tx_hash: "0xdeadbeef" });
    });
  });

  describe("doFetch - schema validation", () => {
    it("throws when response violates schema (ApiError status=0, code='validation_error')", async () => {
      const api = new BackendApiClient();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        // price_usd is invalid (non-numeric) — violates numericString refine
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            prices: { USDC: { key: "USDC", symbol: "USDC", price_usd: "abc" } },
            updated_at: "2026-04-19T00:00:00Z"
          })
        );

        await expect(api.getPrices()).rejects.toBeInstanceOf(ApiError);

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            prices: { USDC: { key: "USDC", symbol: "USDC", price_usd: "abc" } },
            updated_at: "2026-04-19T00:00:00Z"
          })
        );
        try {
          await api.getPrices();
          throw new Error("expected throw");
        } catch (err) {
          expect(err).toBeInstanceOf(ApiError);
          const apiErr = err as ApiError;
          expect(apiErr.status).toBe(0);
          expect(apiErr.code).toBe("validation_error");
        }
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("should include the path in the validation error message", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          prices: { USDC: { key: "USDC", symbol: "USDC", price_usd: "abc" } },
          updated_at: "2026-04-19T00:00:00Z"
        })
      );

      // Silence the expected console.error from the schema validation path
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await api.getPrices();
        throw new Error("expected throw");
      } catch (err) {
        expect((err as ApiError).message).toContain("/api/prices");
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("doFetch - 429 rate limiting", () => {
    it("should invoke onRateLimited callback on 429", async () => {
      const api = new BackendApiClient();
      const cb = vi.fn();
      api.onRateLimited = cb;
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "rate_limited", message: "slow down" } }, 429));

      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should still throw ApiError on 429 when onRateLimited is not configured", async () => {
      // Construct client WITHOUT onRateLimited set (default is null).
      const api = new BackendApiClient();
      expect(api.onRateLimited).toBeNull();

      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: { code: "rate_limited", message: "slow down" } }, 429)
      );
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      // Verify behavior: should throw with status 429 and code from body,
      // without attempting to call an undefined callback.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: { code: "rate_limited", message: "slow down" } }, 429)
      );
      await expect(api.getEarnStats()).rejects.toMatchObject({
        status: 429,
        code: "rate_limited"
      });
    });

    it("should fall back to code='unknown_error' if 429 body has no code", async () => {
      const api = new BackendApiClient();
      api.onRateLimited = vi.fn();
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));

      try {
        await api.getEarnStats();
        throw new Error("expected throw");
      } catch (err) {
        expect((err as ApiError).code).toBe("unknown_error");
        expect((err as ApiError).status).toBe(429);
      }
    });

    it("should debounce onRateLimited within 5 seconds", async () => {
      vi.useFakeTimers();
      const api = new BackendApiClient();
      const cb = vi.fn();
      api.onRateLimited = cb;

      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      vi.advanceTimersByTime(1000);

      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should allow onRateLimited again after 5s", async () => {
      vi.useFakeTimers();
      const api = new BackendApiClient();
      const cb = vi.fn();
      api.onRateLimited = cb;

      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      // Advance past the 5s debounce window
      vi.advanceTimersByTime(5001);

      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      expect(cb).toHaveBeenCalledTimes(2);
    });
  });

  describe("doFetch - non-429 errors", () => {
    it("throws when 400 JSON body present (ApiError with status/code/message from body)", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "bad_request", message: "missing field" } }, 400));

      try {
        await api.getEarnStats();
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe("bad_request");
        expect(apiErr.message).toBe("missing field");
      }
    });

    it("throws when body is non-JSON (ApiError 500, 'unknown_error', default)", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(malformedErrorResponse(500));

      try {
        await api.getEarnStats();
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.code).toBe("unknown_error");
        expect(apiErr.message).toBe("Request failed with status 500");
      }
    });

    it("throws when body is empty (ApiError 500, 'unknown_error', default)", async () => {
      const api = new BackendApiClient();
      // An error response with an empty body (json() throws).
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("empty");
        },
        text: async () => "",
        headers: new Headers()
      } as unknown as Response);

      try {
        await api.getEarnStats();
        throw new Error("expected throw");
      } catch (err) {
        expect((err as ApiError).status).toBe(500);
        expect((err as ApiError).code).toBe("unknown_error");
      }
    });
  });

  describe("doFetch - 204 empty body", () => {
    it("should return undefined on 204 (documents FINDING-4)", async () => {
      // FINDING-4: doFetch short-circuits on 204 and returns undefined. If a
      // caller method expects a JSON body and receives undefined, downstream
      // code may blow up. Today only transport behavior is tested.
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(emptyResponse(204));

      const result = await api.getEarnStats();
      expect(result).toBeUndefined();
    });
  });

  describe("request - coalescing", () => {
    it("should coalesce two parallel GETs to the same URL into one fetch call", async () => {
      const api = new BackendApiClient();
      // Delay the fetch so the second call arrives while the first is in flight
      let resolveFetch: (response: Response) => void = () => {};
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      );

      const p1 = api.getPrices();
      const p2 = api.getPrices();

      // Resolve the single in-flight fetch
      resolveFetch(jsonResponse(validPricesPayload()));

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
    });

    it("should NOT coalesce POST requests", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

      await Promise.all([
        api.trackSkipTransaction("osmosis-1", "0xaaa"),
        api.trackSkipTransaction("osmosis-1", "0xaaa")
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should NOT coalesce GETs to different URLs", async () => {
      const api = new BackendApiClient();
      fetchMock
        .mockResolvedValueOnce(jsonResponse(validPricesPayload()))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await Promise.all([api.getPrices(), api.getEarnStats()]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should clean up cache when request rejects — next GET triggers a new fetch", async () => {
      const api = new BackendApiClient();
      // First call rejects at the fetch layer
      fetchMock.mockRejectedValueOnce(new TypeError("network down"));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(TypeError);

      // Second, later call should issue a fresh fetch (cache cleared)
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await api.getEarnStats();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should clean up cache when request resolves with error — next GET triggers a new fetch", async () => {
      const api = new BackendApiClient();
      // First call: 500 error
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "server_error", message: "boom" } }, 500));
      await expect(api.getEarnStats()).rejects.toBeInstanceOf(ApiError);

      // Second call after first settles: must trigger new fetch
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await api.getEarnStats();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // Thin-wrapper smoke tests: every public method should route to the right
  // URL+method via request(). Stubs fetch with a permissive payload (empty
  // object / empty array) so schema-guarded methods that tolerate missing
  // optional fields short-circuit, and the rest simply return the stub.
  // When a method is schema-guarded we instead feed a minimal valid payload.
  describe("public method URL/method coverage", () => {
    const okStub = () => jsonResponse({});
    const okArr = () => jsonResponse([]);

    // Helper: assert fetch was called with URL containing path and given method
    const expectCall = (path: string, method: string) => {
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain(path);
      expect(init?.method).toBe(method);
    };

    it("should map getConfig to GET /api/config", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okStub());
      await api.getConfig();
      expectCall("/api/config", "GET");
    });

    it("should map getCurrencies to GET /api/currencies", async () => {
      const api = new BackendApiClient();
      // transformCurrenciesResponse expects currencies (record), lpn (array),
      // lease_currencies (array), and map (record).
      fetchMock.mockResolvedValueOnce(jsonResponse({ currencies: {}, lpn: [], lease_currencies: [], map: {} }));
      await api.getCurrencies();
      expectCall("/api/currencies", "GET");
    });

    it("should map getLeases to GET /api/leases with schema", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ leases: [], total_collateral_usd: "0", total_debt_usd: "0" }));
      await api.getLeases("nolus1owner");
      expectCall("/api/leases", "GET");
    });

    it("should map getLease to GET /api/leases/:address", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          address: "nolus1lease",
          protocol: "osmosis-noble",
          status: "opened",
          amount: { ticker: "ATOM", amount: "0" },
          debt: {
            ticker: "USDC",
            principal: "0",
            overdue_margin: "0",
            overdue_interest: "0",
            due_margin: "0",
            due_interest: "0",
            total: "0"
          },
          interest: { loan_rate: 0, margin_rate: 0, annual_rate_percent: 0 }
        })
      );
      await api.getLease("nolus1lease", "osmosis-noble");
      expectCall("/api/leases/nolus1lease", "GET");
    });

    it("should map getLeaseHistory to GET /api/leases/:address/history", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okArr());
      await api.getLeaseHistory("nolus1lease", 0, 10);
      expectCall("/api/leases/nolus1lease/history", "GET");
    });

    it("should map getLeaseQuote to POST /api/leases/quote", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okStub());
      await api.getLeaseQuote({} as Parameters<typeof api.getLeaseQuote>[0]);
      expectCall("/api/leases/quote", "POST");
    });

    it("should map getEarnPools to GET /api/earn/pools", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okArr());
      await api.getEarnPools();
      expectCall("/api/earn/pools", "GET");
    });

    it("should map getEarnPositions to GET /api/earn/positions", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ positions: [], total_deposited_usd: "0" }));
      await api.getEarnPositions("nolus1addr");
      expectCall("/api/earn/positions", "GET");
    });

    it("should map getEarnStats to GET /api/earn/stats", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okStub());
      await api.getEarnStats();
      expectCall("/api/earn/stats", "GET");
    });

    it("should map validator and staking endpoints (getValidators / getValidator / getStakingPositions / getStakingParams)", async () => {
      const paths: [string, () => Promise<unknown>][] = [
        ["/api/staking/validators", () => new BackendApiClient().getValidators("bonded")],
        ["/api/staking/validators/nolusvaloper1", () => new BackendApiClient().getValidator("nolusvaloper1")],
        ["/api/staking/positions", () => new BackendApiClient().getStakingPositions("nolus1x")],
        ["/api/staking/params", () => new BackendApiClient().getStakingParams()]
      ];
      for (const [path, fn] of paths) {
        fetchMock.mockResolvedValueOnce(okArr());
        await fn();
        expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(path);
      }
    });

    it("should handle skip route endpoints", async () => {
      const api = new BackendApiClient();

      fetchMock.mockResolvedValueOnce(okArr());
      await api.getSkipChains();
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/swap/chains");

      fetchMock.mockResolvedValueOnce(okStub());
      await api.getSkipRoute({} as Parameters<typeof api.getSkipRoute>[0]);
      expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("POST");

      fetchMock.mockResolvedValueOnce(okStub());
      await api.getSkipMessages({} as Parameters<typeof api.getSkipMessages>[0]);
      expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("POST");

      fetchMock.mockResolvedValueOnce(okStub());
      await api.getSkipStatus("osmosis-1", "0xhash");
      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/swap/status/0xhash");
    });

    it("should handle governance endpoints", async () => {
      const api = new BackendApiClient();
      const cases: [string, () => Promise<unknown>][] = [
        ["/api/governance/proposals", () => api.getProposals(10, "nolus1v")],
        ["/api/governance/proposals/1/tally", () => api.getProposalTally("1")],
        ["/api/governance/proposals/1/votes/nolus1v", () => api.getProposalVote("1", "nolus1v")],
        ["/api/governance/params/tallying", () => api.getTallyingParams()],
        ["/api/governance/staking-pool", () => api.getStakingPool()],
        ["/api/governance/apr", () => api.getApr()],
        ["/api/governance/accounts/nolus1x", () => api.getAccount("nolus1x")],
        ["/api/governance/denoms/", () => api.getDenomMetadata("uusdc")],
        ["/api/governance/hidden-proposals", () => api.getHiddenProposals()]
      ];
      for (const [path, fn] of cases) {
        fetchMock.mockResolvedValueOnce(okStub());
        await fn();
        expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(path);
      }
    });

    it("should handle node / networks / assets / protocols / config endpoints", async () => {
      const api = new BackendApiClient();
      const cases: [string, () => Promise<unknown>][] = [
        ["/api/node/info", () => api.getNodeInfo()],
        ["/api/node/status", () => api.getNetworkStatus()],
        ["/api/networks/gated", () => api.getGatedNetworks()],
        ["/api/assets", () => api.getAssets()],
        ["/api/networks/osmosis-1/assets", () => api.getNetworkAssets("osmosis-1")],
        ["/api/protocols/gated", () => api.getGatedProtocols()],
        ["/api/protocols/osmosis-noble/currencies", () => api.getProtocolCurrencies("osmosis-noble")],
        ["/api/leases/config/osmosis-noble", () => api.getLeaseConfig("osmosis-noble")],
        ["/api/swap/config", () => api.getSwapConfig()],
        ["/api/locales/en", () => api.getLocale("en")]
      ];
      for (const [path, fn] of cases) {
        fetchMock.mockResolvedValueOnce(okStub());
        await fn();
        expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(path);
      }
    });

    it("should map getGasFeeConfig to GET /api/fees/gas-config (schema-guarded)", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ gas_prices: { uusdc: "0.025" }, gas_multiplier: 1.2 }));
      await api.getGasFeeConfig();
      expectCall("/api/fees/gas-config", "GET");
    });

    it("should map getIntercomToken to POST /api/intercom/hash", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(jsonResponse({ token: "abc" }));
      await api.getIntercomToken("nolus1x", "keplr");
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/api/intercom/hash");
      expect(init?.method).toBe("POST");
      const parsed = JSON.parse(init?.body as string);
      expect(parsed).toEqual({ wallet: "nolus1x", wallet_type: "keplr" });
    });

    it("should handle ETL endpoints", async () => {
      const api = new BackendApiClient();
      const cases: [string, () => Promise<unknown>][] = [
        ["/api/etl/batch/stats-overview", () => api.getStatsOverview()],
        ["/api/etl/batch/loans-stats", () => api.getLoansStats()],
        ["/api/etl/batch/user-dashboard", () => api.getUserDashboard("nolus1x")],
        ["/api/etl/batch/user-history", () => api.getUserHistory("nolus1x")],
        ["/api/etl/prices", () => api.getPriceSeries("USDC", "osmosis-noble", "1d")],
        ["/api/etl/pnl-over-time", () => api.getPnlOverTime("nolus1x", "1w")],
        ["/api/etl/leased-assets", () => api.getLeasedAssets()],
        ["/api/etl/leases-monthly", () => api.getMonthlyLeases("30d")],
        ["/api/etl/supplied-borrowed-history", () => api.getSupplyBorrowHistory("30d")],
        ["/api/etl/ls-opening", () => api.getLeaseOpening("nolus1lease")],
        ["/api/etl/earnings", () => api.getEarnings("nolus1x")],
        ["/api/etl/position-debt-value", () => api.getPositionDebtValue("nolus1x")],
        ["/api/etl/realized-pnl", () => api.getRealizedPnl("nolus1x")],
        ["/api/etl/realized-pnl-data", () => api.getRealizedPnlData("nolus1x")],
        ["/api/etl/history-stats", () => api.getHistoryStats("nolus1x")],
        ["/api/etl/ls-loan-closing", () => api.getPnlLog("nolus1x", 0, 10)],
        ["/api/etl/lp-withdraw", () => api.getLpWithdraw("0xtx")],
        ["/api/etl/supplied-funds", () => api.getSuppliedFunds()],
        ["/api/etl/pools", () => api.getEtlPools()]
      ];
      for (const [path, fn] of cases) {
        fetchMock.mockResolvedValueOnce(okArr());
        await fn();
        expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(path);
      }
    });

    it("should assemble getTransactions filter params correctly", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okArr());
      await api.getTransactions("nolus1x", 0, 25, {
        positions: true,
        transfers: false,
        earn: false,
        staking: false,
        positions_ids: ["nolus1p1", "nolus1p2"]
      });
      const [url] = fetchMock.mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).toContain("/api/etl/txs");
      expect(urlStr).toContain("filter=positions");
      expect(urlStr).toContain("to=nolus1p1%2Cnolus1p2");
    });

    it("should send no filter in getTransactions when all main filters are true", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okArr());
      await api.getTransactions("nolus1x", 0, 25, {
        positions: true,
        transfers: true,
        earn: true,
        staking: true
      });
      const [url] = fetchMock.mock.calls[0];
      expect(String(url)).not.toContain("filter=");
    });

    it("should handle searchLeases with and without search param", async () => {
      const api = new BackendApiClient();
      fetchMock.mockResolvedValueOnce(okArr());
      await api.searchLeases("nolus1x", 0, 10, "foo");
      expect(String(fetchMock.mock.calls[0][0])).toContain("search=foo");

      fetchMock.mockResolvedValueOnce(okArr());
      await api.searchLeases("nolus1x", 0, 10);
      expect(String(fetchMock.mock.calls[1][0])).not.toContain("search=");
    });
  });
});
