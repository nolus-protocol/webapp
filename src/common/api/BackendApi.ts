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
  // Campaigns
  ActiveCampaignsResponse,
  CampaignEligibilityResponse,
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
  // Webapp
  WebappCurrenciesConfig,
  WebappChainIdsConfig,
  WebappHistoryCurrenciesConfig,
  WebappHistoryProtocolsConfig,
  WebappNetworkEndpointsConfig,
  WebappDownpaymentRange,
  WebappDueProjectionConfig,
  WebappZeroInterestAddresses,
  WebappSkipRouteConfig,
  WebappProposalsConfig,
  // ETL
  StatsOverviewBatchResponse,
  LoansStatsBatchResponse,
  UserDashboardBatchResponse,
  UserHistoryBatchResponse,
  PriceSeriesResponse,
  PnlOverTimeResponse,
  LeasesMonthlyResponse,
  LeasedAssetsResponse,
  TimeSeriesResponse,
  TxsResponse,
  TransactionFilters,
  LeaseOpeningResponse,
  LeaseClosingResponse,
  LeasesSearchResponse,
  LpWithdrawResponse,
  RealizedPnlDataResponse,
} from "./types";

import { ApiError as ApiErrorClass } from "./types";

// Backend URL - must be configured via environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("VITE_BACKEND_URL environment variable is required");
}

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
    const url = new URL(`${this.baseUrl}${path}`);

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
      fetchPromise.finally(() => {
        this.inFlight.delete(cacheKey);
      }).catch(() => {});
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
      ...options.headers,
    };

    const response = await fetch(urlString, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
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
    return this.request<import("./types").CurrenciesResponse>("GET", "/api/currencies");
  }

  async getPrices(): Promise<PriceData> {
    const response = await this.request<PricesResponse>("GET", "/api/prices");
    const priceData: PriceData = {};
    for (const [key, info] of Object.entries(response.prices)) {
      priceData[key] = {
        price: info.price_usd,
        symbol: info.symbol,
      };
    }
    return priceData;
  }

  async getBalances(address: string): Promise<BalancesResponse> {
    return this.request<BalancesResponse>("GET", "/api/balances", {
      params: { address },
    });
  }

  // =========================================================================
  // Leases
  // =========================================================================

  async getLeases(owner: string): Promise<LeaseInfo[]> {
    const response = await this.request<LeasesResponse>("GET", "/api/leases", {
      params: { owner },
    });
    return response.leases;
  }

  async getLease(address: string): Promise<LeaseInfo> {
    return this.request<LeaseInfo>("GET", `/api/leases/${address}`);
  }

  async getLeaseHistory(address: string, skip?: number, limit?: number): Promise<LeaseHistoryEntry[]> {
    return this.request<LeaseHistoryEntry[]>("GET", `/api/leases/${address}/history`, {
      params: { skip, limit },
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
      params: { address },
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
      params: { status },
    });
  }

  async getValidator(address: string): Promise<ValidatorInfo> {
    return this.request<ValidatorInfo>("GET", `/api/staking/validators/${address}`);
  }

  async getStakingPositions(address: string): Promise<StakingPositionsResponse> {
    return this.request<StakingPositionsResponse>("GET", "/api/staking/positions", {
      params: { address },
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
      params: { include_evm: includeEvm, include_svm: includeSvm },
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
      params: { chain_id: chainId },
    });
  }

  async trackSkipTransaction(chainId: string, txHash: string): Promise<SkipTrackResponse> {
    return this.request<SkipTrackResponse>("POST", "/api/swap/track", {
      body: { chain_id: chainId, tx_hash: txHash },
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
      body: { wallet_address: walletAddress },
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
      params: options,
    });
  }

  async getReferralRewards(
    walletAddress: string,
    options?: { status?: RewardStatusType; limit?: number; offset?: number }
  ): Promise<RewardsListResponse> {
    return this.request<RewardsListResponse>("GET", `/api/referral/rewards/${walletAddress}`, {
      params: options,
    });
  }

  async getReferralPayouts(
    walletAddress: string,
    options?: { status?: PayoutStatusType; limit?: number; offset?: number }
  ): Promise<PayoutsListResponse> {
    return this.request<PayoutsListResponse>("GET", `/api/referral/payouts/${walletAddress}`, {
      params: options,
    });
  }

  async assignReferral(referralCode: string, referredWallet: string): Promise<AssignReferralResponse> {
    return this.request<AssignReferralResponse>("POST", "/api/referral/assign", {
      body: { referral_code: referralCode, referred_wallet: referredWallet },
    });
  }

  // =========================================================================
  // Campaigns
  // =========================================================================

  async getActiveCampaigns(): Promise<ActiveCampaignsResponse> {
    return this.request<ActiveCampaignsResponse>("GET", "/api/campaigns/active");
  }

  async checkCampaignEligibility(
    wallet: string,
    protocol?: string,
    currency?: string
  ): Promise<CampaignEligibilityResponse> {
    return this.request<CampaignEligibilityResponse>("GET", "/api/campaigns/eligibility", {
      params: { wallet, protocol, currency },
    });
  }

  // =========================================================================
  // Governance
  // =========================================================================

  async getProposals(limit?: number, voter?: string): Promise<ProposalsResponse> {
    return this.request<ProposalsResponse>("GET", "/api/governance/proposals", {
      params: { limit, voter },
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
  // Webapp Configuration
  // =========================================================================

  async getWebappCurrencies(): Promise<WebappCurrenciesConfig> {
    return this.request<WebappCurrenciesConfig>("GET", "/api/webapp/config/currencies");
  }

  async getWebappChainIds(): Promise<WebappChainIdsConfig> {
    return this.request<WebappChainIdsConfig>("GET", "/api/webapp/config/chain-ids");
  }

  async getWebappHistoryCurrencies(): Promise<WebappHistoryCurrenciesConfig> {
    return this.request<WebappHistoryCurrenciesConfig>("GET", "/api/webapp/config/history-currencies");
  }

  async getWebappHistoryProtocols(): Promise<WebappHistoryProtocolsConfig> {
    return this.request<WebappHistoryProtocolsConfig>("GET", "/api/webapp/config/history-protocols");
  }

  async getWebappNetworkEndpoints(network: string): Promise<WebappNetworkEndpointsConfig> {
    return this.request<WebappNetworkEndpointsConfig>("GET", `/api/webapp/config/endpoints/${network}`);
  }

  async getWebappDownpaymentRangeForProtocol(protocol: string): Promise<WebappDownpaymentRange> {
    return this.request<WebappDownpaymentRange>("GET", `/api/webapp/config/lease/downpayment-ranges/${protocol}`);
  }

  async getWebappIgnoreAssets(): Promise<string[]> {
    return this.request<string[]>("GET", "/api/webapp/config/lease/ignore-assets");
  }

  async getWebappIgnoreLeaseLong(): Promise<string[]> {
    return this.request<string[]>("GET", "/api/webapp/config/lease/ignore-lease-long");
  }

  async getWebappIgnoreLeaseShort(): Promise<string[]> {
    return this.request<string[]>("GET", "/api/webapp/config/lease/ignore-lease-short");
  }

  async getWebappFreeInterestAssets(): Promise<string[]> {
    return this.request<string[]>("GET", "/api/webapp/config/lease/free-interest");
  }

  async getWebappDueProjection(): Promise<WebappDueProjectionConfig> {
    return this.request<WebappDueProjectionConfig>("GET", "/api/webapp/config/lease/due-projection");
  }

  async getWebappZeroInterestAddresses(): Promise<WebappZeroInterestAddresses> {
    return this.request<WebappZeroInterestAddresses>("GET", "/api/webapp/config/zero-interest/addresses");
  }

  async getWebappSkipRouteConfig(): Promise<WebappSkipRouteConfig> {
    return this.request<WebappSkipRouteConfig>("GET", "/api/webapp/config/swap/skip-route");
  }

  async getWebappHiddenProposals(): Promise<WebappProposalsConfig> {
    return this.request<WebappProposalsConfig>("GET", "/api/webapp/config/governance/hidden-proposals");
  }

  async getWebappLocale(lang: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `/api/webapp/locales/${lang}`);
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
      params: { address },
    });
  }

  /**
   * Fetch user history batch (history stats, realized PnL data)
   */
  async getUserHistory(address: string): Promise<UserHistoryBatchResponse> {
    return this.request<UserHistoryBatchResponse>("GET", "/api/etl/batch/user-history", {
      params: { address },
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
  ): Promise<TxsResponse> {
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

    return this.request<TxsResponse>("GET", "/api/etl/txs", { params });
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
   */
  async getPriceSeries(
    key: string,
    protocol: string,
    interval: string
  ): Promise<PriceSeriesResponse> {
    return this.request<PriceSeriesResponse>("GET", "/api/etl/prices", {
      params: { key, protocol, interval },
    });
  }

  /**
   * Fetch PnL over time for charting
   */
  async getPnlOverTime(address: string, interval: string): Promise<PnlOverTimeResponse> {
    return this.request<PnlOverTimeResponse>("GET", "/api/etl/pnl-over-time", {
      params: { address, interval },
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
  async getMonthlyLeases(): Promise<LeasesMonthlyResponse> {
    return this.request<LeasesMonthlyResponse>("GET", "/api/etl/leases-monthly");
  }

  /**
   * Fetch supply/borrow history time series
   */
  async getSupplyBorrowHistory(period?: string): Promise<TimeSeriesResponse> {
    return this.request<TimeSeriesResponse>("GET", "/api/etl/supplied-borrowed-history", {
      params: period ? { period } : undefined,
    });
  }

  /**
   * Fetch lease opening data
   */
  async getLeaseOpening(leaseAddress: string): Promise<LeaseOpeningResponse> {
    return this.request<LeaseOpeningResponse>("GET", "/api/etl/ls-opening", {
      params: { lease: leaseAddress },
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
  async getPnlLog(address: string, skip: number = 0, limit: number = 10): Promise<LeaseClosingResponse> {
    return this.request<LeaseClosingResponse>("GET", "/api/etl/ls-loan-closing", {
      params: { address, skip, limit },
    });
  }

  /**
   * Fetch LP withdraw data by transaction hash
   */
  async getLpWithdraw(txHash: string): Promise<LpWithdrawResponse> {
    return this.request<LpWithdrawResponse>("GET", "/api/etl/lp-withdraw", {
      params: { tx_hash: txHash },
    });
  }
}

// Export singleton instance
export const BackendApi = new BackendApiClient();
