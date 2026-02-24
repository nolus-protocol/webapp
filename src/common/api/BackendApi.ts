/**
 * BackendApi - Client for the Nolus Rust backend
 *
 * This replaces direct EtlApi, RPC, and other external API calls.
 * All data flows through the backend which handles caching, rate limiting,
 * and external service integration.
 *
 * Types are organized in separate files under ./types/ for better maintainability.
 */

// Re-export all types
export * from "./types";

// Import types for internal use
import type {
  // Config
  AppConfigResponse,
  // Prices
  PricesResponse,
  PriceData,
  BalancesResponse,
  // Leases
  LeaseInfo,
  LeasesResponse,
  LeaseHistoryEntry,
  LeaseQuoteRequest,
  LeaseQuoteResponse,
  LeaseConfigResponse,
  // Earn
  EarnPool,
  EarnPositionsResponse,
  EarnStats,
  // Staking
  ValidatorInfo,
  StakingPositionsResponse,
  StakingParams,
  // Skip Route
  SkipChain,
  SkipRouteRequest,
  SkipRouteResponse,
  SkipMessagesRequest,
  SkipMessagesResponse,
  SkipTrackResponse,
  // Referral
  ValidateCodeResponse,
  RegisterReferrerResponse,
  ReferrerStatsResponse,
  ReferralsListResponse,
  RewardsListResponse,
  PayoutsListResponse,
  AssignReferralResponse,
  ReferralStatusType,
  RewardStatusType,
  PayoutStatusType,
  // Governance
  ProposalsResponse,
  TallyResult,
  TallyingParams,
  StakingPoolInfo,
  AprInfo,
  AccountInfo,
  DenomMetadataInfo,
  NodeInfoResponse,
  NetworkStatusResponse,
  GatedNetworksResponse,
  HiddenProposalsResponse,
  // Swap
  SwapConfigResponse,
  // ETL
  StatsOverviewBatchResponse,
  LoansStatsBatchResponse,
  UserDashboardBatchResponse,
  UserHistoryBatchResponse,
  PriceSeriesDataPoint,
  PnlOverTimeDataPoint,
  LeasesMonthlyResponse,
  LeasedAssetsResponse,
  TimeSeriesResponse,
  TxEntry,
  TransactionFilters,
  LeaseOpeningResponse,
  LeaseClosingEntry,
  LeasesSearchResponse,
  LpWithdrawResponse,
  RealizedPnlDataResponse
} from "./types";

import { ApiError as ApiErrorClass } from "./types";

// Backend URL from environment, falls back to same-origin (for Vite dev proxy)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

/**
 * Main Backend API Client
 *
 * Features:
 * - Request coalescing: Multiple simultaneous requests to the same endpoint
 *   are deduplicated into a single network call.
 */
export class BackendApiClient {
  private baseUrl: string;

  /**
   * In-flight requests map for coalescing
   * Key: "METHOD:URL" (e.g., "GET:/api/prices")
   * Value: Promise that resolves when the request completes
   */
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string = BACKEND_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a cache key for request coalescing
   * Only GET requests without body are coalesced
   */
  private getCacheKey(method: string, url: string, hasBody: boolean): string | null {
    if (method !== "GET" || hasBody) {
      return null;
    }
    return `${method}:${url}`;
  }

  /**
   * Make an authenticated request to the backend
   * GET requests are coalesced - multiple identical requests in-flight
   * will share the same network call.
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = this.baseUrl
      ? new URL(`${this.baseUrl}${path}`)
      : new URL(path, window.location.origin);

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const urlString = url.toString();
    const cacheKey = this.getCacheKey(method, urlString, !!options.body);

    if (cacheKey) {
      const existing = this.inFlight.get(cacheKey);
      if (existing) {
        return existing as Promise<T>;
      }
    }

    const fetchPromise = this.doFetch<T>(method, urlString, options);

    if (cacheKey) {
      this.inFlight.set(cacheKey, fetchPromise);
      // Cleanup in-flight cache after promise settles
      // The .catch(() => {}) prevents unhandled rejection warnings from the cleanup chain
      fetchPromise
        .finally(() => {
          this.inFlight.delete(cacheKey);
        })
        .catch(() => {});
    }

    return fetchPromise;
  }

  private async doFetch<T>(
    method: string,
    urlString: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers
    };

    const response = await fetch(urlString, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiErrorClass(
        response.status,
        errorData.error || "unknown_error",
        errorData.message || `Request failed with status ${response.status}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  async getConfig(): Promise<AppConfigResponse> {
    return this.request<AppConfigResponse>("GET", "/api/config");
  }

  // =========================================================================
  // Currencies & Prices
  // =========================================================================

  async getCurrencies(): Promise<import("./types").CurrenciesResponse> {
    const raw = await this.request<import("./types").RawCurrenciesResponse>("GET", "/api/currencies");
    // Transform snake_case from backend to camelCase for frontend
    const { transformCurrenciesResponse } = await import("./types");
    return transformCurrenciesResponse(raw);
  }

  async getPrices(): Promise<PriceData> {
    const response = await this.request<PricesResponse>("GET", "/api/prices");
    const priceData: PriceData = {};
    for (const [key, info] of Object.entries(response.prices)) {
      priceData[key] = {
        price: info.price_usd,
        symbol: info.symbol
      };
    }
    return priceData;
  }

  async getBalances(address: string): Promise<BalancesResponse> {
    return this.request<BalancesResponse>("GET", "/api/balances", {
      params: { address }
    });
  }

  // =========================================================================
  // Leases
  // =========================================================================

  async getLeases(owner: string): Promise<LeaseInfo[]> {
    const response = await this.request<LeasesResponse>("GET", "/api/leases", {
      params: { owner }
    });
    return response.leases;
  }

  async getLease(address: string): Promise<LeaseInfo> {
    return this.request<LeaseInfo>("GET", `/api/leases/${address}`);
  }

  async getLeaseHistory(address: string, skip?: number, limit?: number): Promise<LeaseHistoryEntry[]> {
    return this.request<LeaseHistoryEntry[]>("GET", `/api/leases/${address}/history`, {
      params: { skip, limit }
    });
  }

  async getLeaseQuote(request: LeaseQuoteRequest): Promise<LeaseQuoteResponse> {
    return this.request<LeaseQuoteResponse>("POST", "/api/leases/quote", { body: request });
  }

  // =========================================================================
  // Earn
  // =========================================================================

  async getEarnPools(): Promise<EarnPool[]> {
    return this.request<EarnPool[]>("GET", "/api/earn/pools");
  }

  async getEarnPositions(address: string): Promise<EarnPositionsResponse> {
    return this.request<EarnPositionsResponse>("GET", "/api/earn/positions", {
      params: { address }
    });
  }

  async getEarnStats(): Promise<EarnStats> {
    return this.request<EarnStats>("GET", "/api/earn/stats");
  }

  // =========================================================================
  // Staking
  // =========================================================================

  async getValidators(status?: string): Promise<ValidatorInfo[]> {
    return this.request<ValidatorInfo[]>("GET", "/api/staking/validators", {
      params: { status }
    });
  }

  async getValidator(address: string): Promise<ValidatorInfo> {
    return this.request<ValidatorInfo>("GET", `/api/staking/validators/${address}`);
  }

  async getStakingPositions(address: string): Promise<StakingPositionsResponse> {
    return this.request<StakingPositionsResponse>("GET", "/api/staking/positions", {
      params: { address }
    });
  }

  async getStakingParams(): Promise<StakingParams> {
    return this.request<StakingParams>("GET", "/api/staking/params");
  }

  // =========================================================================
  // Skip Route (Swap)
  // =========================================================================

  async getSkipChains(includeEvm = true, includeSvm = true): Promise<SkipChain[]> {
    return this.request<SkipChain[]>("GET", "/api/swap/chains", {
      params: { include_evm: includeEvm, include_svm: includeSvm }
    });
  }

  async getSkipRoute(request: SkipRouteRequest): Promise<SkipRouteResponse> {
    return this.request<SkipRouteResponse>("POST", "/api/swap/route", { body: request });
  }

  async getSkipMessages(request: SkipMessagesRequest): Promise<SkipMessagesResponse> {
    return this.request<SkipMessagesResponse>("POST", "/api/swap/messages", { body: request });
  }

  async getSkipStatus(chainId: string, txHash: string): Promise<import("./types").SkipStatusResponse> {
    return this.request("GET", `/api/swap/status/${txHash}`, {
      params: { chain_id: chainId }
    });
  }

  async trackSkipTransaction(chainId: string, txHash: string): Promise<SkipTrackResponse> {
    return this.request<SkipTrackResponse>("POST", "/api/swap/track", {
      body: { chain_id: chainId, tx_hash: txHash }
    });
  }

  // =========================================================================
  // Referral Program
  // =========================================================================

  async validateReferralCode(code: string): Promise<ValidateCodeResponse> {
    return this.request<ValidateCodeResponse>("GET", `/api/referral/validate/${code}`);
  }

  async registerAsReferrer(walletAddress: string): Promise<RegisterReferrerResponse> {
    return this.request<RegisterReferrerResponse>("POST", "/api/referral/register", {
      body: { wallet_address: walletAddress }
    });
  }

  async getReferrerStats(walletAddress: string): Promise<ReferrerStatsResponse> {
    return this.request<ReferrerStatsResponse>("GET", `/api/referral/stats/${walletAddress}`);
  }

  async getReferrals(
    walletAddress: string,
    options?: { status?: ReferralStatusType; limit?: number; offset?: number }
  ): Promise<ReferralsListResponse> {
    return this.request<ReferralsListResponse>("GET", `/api/referral/referrals/${walletAddress}`, {
      params: options
    });
  }

  async getReferralRewards(
    walletAddress: string,
    options?: { status?: RewardStatusType; limit?: number; offset?: number }
  ): Promise<RewardsListResponse> {
    return this.request<RewardsListResponse>("GET", `/api/referral/rewards/${walletAddress}`, {
      params: options
    });
  }

  async getReferralPayouts(
    walletAddress: string,
    options?: { status?: PayoutStatusType; limit?: number; offset?: number }
  ): Promise<PayoutsListResponse> {
    return this.request<PayoutsListResponse>("GET", `/api/referral/payouts/${walletAddress}`, {
      params: options
    });
  }

  async assignReferral(referralCode: string, referredWallet: string): Promise<AssignReferralResponse> {
    return this.request<AssignReferralResponse>("POST", "/api/referral/assign", {
      body: { referral_code: referralCode, referred_wallet: referredWallet }
    });
  }

  // =========================================================================
  // Governance
  // =========================================================================

  async getProposals(limit?: number, voter?: string): Promise<ProposalsResponse> {
    return this.request<ProposalsResponse>("GET", "/api/governance/proposals", {
      params: { limit, voter }
    });
  }

  async getProposalTally(proposalId: string): Promise<{ tally: TallyResult }> {
    return this.request<{ tally: TallyResult }>("GET", `/api/governance/proposals/${proposalId}/tally`);
  }

  async getProposalVote(
    proposalId: string,
    voter: string
  ): Promise<{ vote: { proposal_id: string; voter: string; options: { option: string; weight: string }[] } } | null> {
    return this.request("GET", `/api/governance/proposals/${proposalId}/votes/${voter}`);
  }

  async getTallyingParams(): Promise<{ params: TallyingParams }> {
    return this.request<{ params: TallyingParams }>("GET", "/api/governance/params/tallying");
  }

  async getStakingPool(): Promise<StakingPoolInfo> {
    return this.request<StakingPoolInfo>("GET", "/api/governance/staking-pool");
  }

  async getApr(): Promise<AprInfo> {
    return this.request<AprInfo>("GET", "/api/governance/apr");
  }

  async getAccount(address: string): Promise<AccountInfo> {
    return this.request<AccountInfo>("GET", `/api/governance/accounts/${address}`);
  }

  async getDenomMetadata(denom: string): Promise<DenomMetadataInfo | null> {
    return this.request<DenomMetadataInfo | null>("GET", `/api/governance/denoms/${denom}`);
  }

  // =========================================================================
  // Node
  // =========================================================================

  async getNodeInfo(): Promise<NodeInfoResponse> {
    return this.request<NodeInfoResponse>("GET", "/api/node/info");
  }

  async getNetworkStatus(): Promise<NetworkStatusResponse> {
    return this.request<NetworkStatusResponse>("GET", "/api/node/status");
  }

  // =========================================================================
  // Gated Networks
  // =========================================================================

  async getGatedNetworks(): Promise<GatedNetworksResponse> {
    return this.request<GatedNetworksResponse>("GET", "/api/networks/gated");
  }

  // =========================================================================
  // Assets
  // =========================================================================

  async getAssets(): Promise<import("./types").AssetsResponse> {
    return this.request<import("./types").AssetsResponse>("GET", "/api/assets");
  }

  async getNetworkAssets(network: string): Promise<import("./types").AssetsResponse> {
    return this.request<import("./types").AssetsResponse>("GET", `/api/networks/${network}/assets`);
  }

  // =========================================================================
  // Gated Protocols
  // =========================================================================

  /**
   * Get all configured (gated) protocols
   */
  async getGatedProtocols(): Promise<import("./types").GatedProtocolsResponse> {
    return this.request<import("./types").GatedProtocolsResponse>("GET", "/api/protocols/gated");
  }

  /**
   * Get currencies for a specific protocol with Oracle prices
   */
  async getProtocolCurrencies(protocol: string): Promise<import("./types").ProtocolCurrenciesResponse> {
    return this.request<import("./types").ProtocolCurrenciesResponse>("GET", `/api/protocols/${protocol}/currencies`);
  }

  // =========================================================================
  // Lease Configuration
  // =========================================================================

  async getLeaseConfig(protocol: string): Promise<LeaseConfigResponse> {
    return this.request<LeaseConfigResponse>("GET", `/api/leases/config/${protocol}`);
  }

  // =========================================================================
  // Swap Configuration
  // =========================================================================

  async getSwapConfig(): Promise<SwapConfigResponse> {
    return this.request<SwapConfigResponse>("GET", "/api/swap/config");
  }

  // =========================================================================
  // Governance Configuration
  // =========================================================================

  async getHiddenProposals(): Promise<HiddenProposalsResponse> {
    return this.request<HiddenProposalsResponse>("GET", "/api/governance/hidden-proposals");
  }

  // =========================================================================
  // Fees
  // =========================================================================

  async getGasFeeConfig(): Promise<import("./types").GasFeeConfigResponse> {
    return this.request<import("./types").GasFeeConfigResponse>("GET", "/api/fees/gas-config");
  }

  // =========================================================================
  // Locales
  // =========================================================================

  async getLocale(lang: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `/api/locales/${lang}`);
  }

  // =========================================================================
  // Intercom
  // =========================================================================

  /**
   * Get Intercom JWT token for user authentication
   */
  async getIntercomToken(wallet: string, attributes?: Record<string, unknown>): Promise<{ token: string }> {
    const body: { wallet: string; attributes?: Record<string, unknown> } = { wallet };
    if (attributes && Object.keys(attributes).length > 0) {
      body.attributes = attributes;
    }
    return this.request<{ token: string }>("POST", "/api/intercom/hash", { body });
  }

  // =========================================================================
  // ETL - Analytics & Statistics
  // =========================================================================

  /**
   * Fetch stats overview batch (TVL, tx volume, buyback, realized PnL stats, revenue)
   */
  async getStatsOverview(): Promise<StatsOverviewBatchResponse> {
    return this.request<StatsOverviewBatchResponse>("GET", "/api/etl/batch/stats-overview");
  }

  /**
   * Fetch loans stats batch (open position value, open interest)
   */
  async getLoansStats(): Promise<LoansStatsBatchResponse> {
    return this.request<LoansStatsBatchResponse>("GET", "/api/etl/batch/loans-stats");
  }

  /**
   * Fetch user dashboard batch (earnings, realized PnL, position/debt value)
   */
  async getUserDashboard(address: string): Promise<UserDashboardBatchResponse> {
    return this.request<UserDashboardBatchResponse>("GET", "/api/etl/batch/user-dashboard", {
      params: { address }
    });
  }

  /**
   * Fetch user history batch (history stats, realized PnL data)
   */
  async getUserHistory(address: string): Promise<UserHistoryBatchResponse> {
    return this.request<UserHistoryBatchResponse>("GET", "/api/etl/batch/user-history", {
      params: { address }
    });
  }

  /**
   * Fetch transaction history
   */
  async getTransactions(
    address: string,
    skip: number = 0,
    limit: number = 50,
    filters?: TransactionFilters
  ): Promise<TxEntry[]> {
    const params: Record<string, string | number> = { address, skip, limit };

    if (filters) {
      // If all main filters are true, don't send any filter
      if (!(filters.positions && filters.transfers && filters.earn && filters.staking)) {
        const activeFilters = Object.keys(filters).filter(
          (k) => k !== "positions_ids" && filters[k as keyof TransactionFilters]
        );
        if (activeFilters.length > 0) {
          params.filter = activeFilters.join(",");
        }
      }

      if (filters.positions_ids && filters.positions_ids.length > 0) {
        params.to = filters.positions_ids.join(",");
      }
    }

    return this.request<TxEntry[]>("GET", "/api/etl/txs", { params });
  }

  /**
   * Search leases by address
   */
  async searchLeases(
    address: string,
    skip: number = 0,
    limit: number = 50,
    search?: string
  ): Promise<LeasesSearchResponse> {
    const params: Record<string, string | number> = { address, skip, limit };
    if (search && search.length > 0) {
      params.search = search;
    }
    return this.request<LeasesSearchResponse>("GET", "/api/etl/leases-search", { params });
  }

  /**
   * Fetch price series for charting
   * ETL returns raw array of [timestamp, price] tuples
   */
  async getPriceSeries(key: string, protocol: string, interval: string): Promise<PriceSeriesDataPoint[]> {
    return this.request<PriceSeriesDataPoint[]>("GET", "/api/etl/prices", {
      params: { key, protocol, interval }
    });
  }

  /**
   * Fetch PnL over time for charting
   * ETL returns raw array of {amount, date} objects
   */
  async getPnlOverTime(address: string, interval: string): Promise<PnlOverTimeDataPoint[]> {
    return this.request<PnlOverTimeDataPoint[]>("GET", "/api/etl/pnl-over-time", {
      params: { address, interval }
    });
  }

  /**
   * Fetch leased assets breakdown
   */
  async getLeasedAssets(): Promise<LeasedAssetsResponse> {
    return this.request<LeasedAssetsResponse>("GET", "/api/etl/leased-assets");
  }

  /**
   * Fetch monthly leases statistics
   */
  async getMonthlyLeases(period?: string): Promise<LeasesMonthlyResponse> {
    return this.request<LeasesMonthlyResponse>("GET", "/api/etl/leases-monthly", {
      params: period ? { period } : undefined
    });
  }

  /**
   * Fetch supply/borrow history time series
   */
  async getSupplyBorrowHistory(period?: string): Promise<TimeSeriesResponse> {
    return this.request<TimeSeriesResponse>("GET", "/api/etl/supplied-borrowed-history", {
      params: period ? { period } : undefined
    });
  }

  /**
   * Fetch lease opening data
   */
  async getLeaseOpening(leaseAddress: string): Promise<LeaseOpeningResponse> {
    return this.request<LeaseOpeningResponse>("GET", "/api/etl/ls-opening", {
      params: { lease: leaseAddress }
    });
  }

  /**
   * Fetch user earnings
   */
  async getEarnings(address: string): Promise<import("./types").EarningsResponse> {
    return this.request("GET", "/api/etl/earnings", { params: { address } });
  }

  /**
   * Fetch position/debt value
   */
  async getPositionDebtValue(address: string): Promise<import("./types").PositionDebtValueResponse> {
    return this.request("GET", "/api/etl/position-debt-value", { params: { address } });
  }

  /**
   * Fetch realized PnL for user
   */
  async getRealizedPnl(address: string): Promise<import("./types").UserRealizedPnlResponse> {
    return this.request("GET", "/api/etl/realized-pnl", { params: { address } });
  }

  /**
   * Fetch realized PnL data details
   */
  async getRealizedPnlData(address: string): Promise<RealizedPnlDataResponse> {
    return this.request<RealizedPnlDataResponse>("GET", "/api/etl/realized-pnl-data", { params: { address } });
  }

  /**
   * Fetch history stats
   */
  async getHistoryStats(address: string): Promise<import("./types").HistoryStatsResponse> {
    return this.request("GET", "/api/etl/history-stats", { params: { address } });
  }

  /**
   * Fetch PnL log (closed positions, paginated)
   */
  async getPnlLog(address: string, skip: number = 0, limit: number = 10): Promise<LeaseClosingEntry[]> {
    return this.request<LeaseClosingEntry[]>("GET", "/api/etl/ls-loan-closing", {
      params: { address, skip, limit }
    });
  }

  /**
   * Fetch LP withdraw data by transaction hash
   */
  async getLpWithdraw(txHash: string): Promise<LpWithdrawResponse> {
    return this.request<LpWithdrawResponse>("GET", "/api/etl/lp-withdraw", {
      params: { tx: txHash }
    });
  }

  /**
   * Fetch supplied funds total (from ETL)
   */
  async getSuppliedFunds(): Promise<import("./types").SuppliedFundsResponse> {
    return this.request<import("./types").SuppliedFundsResponse>("GET", "/api/etl/supplied-funds");
  }

  /**
   * Fetch ETL pools data (includes deposit_suspension threshold)
   */
  async getEtlPools(): Promise<import("./types").PoolsResponse> {
    return this.request<import("./types").PoolsResponse>("GET", "/api/etl/pools");
  }
}

// Export singleton instance
export const BackendApi = new BackendApiClient();
