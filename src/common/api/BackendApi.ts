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
  ApiError,
  CoinAmount,
  TransactionHistoryEntry,
  IntercomHashResponse,
  // Config
  AppConfigResponse,
  ProtocolInfo,
  NetworkInfo,
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
  // Swap
  SwapQuoteRequest,
  SwapQuoteResponse,
  SwapExecuteRequest,
  SwapExecuteResponse,
  SwapStatusResponse,
  SwapMessage,
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
  // Zero Interest
  ZeroInterestConfig,
  ZeroInterestEligibility,
  ZeroInterestPayment,
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
  WebappFullConfig,
  WebappCurrenciesConfig,
  WebappChainIdsConfig,
  WebappHistoryCurrenciesConfig,
  WebappHistoryProtocolsConfig,
  WebappEndpointsCollection,
  WebappNetworkEndpointsConfig,
  WebappDownpaymentRangesConfig,
  WebappDownpaymentRange,
  WebappDueProjectionConfig,
  WebappZeroInterestAddresses,
  WebappSkipRouteConfig,
  WebappProposalsConfig,
  WebappLocalesListResponse,
} from "./types";

import { ApiError as ApiErrorClass } from "./types";

// Backend URL - configurable via environment
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

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

  async getProtocols(): Promise<{ [key: string]: ProtocolInfo }> {
    return this.request<{ [key: string]: ProtocolInfo }>("GET", "/api/config/protocols");
  }

  async getNetworks(): Promise<NetworkInfo[]> {
    return this.request<NetworkInfo[]>("GET", "/api/config/networks");
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

  async getPricesRaw(): Promise<PricesResponse> {
    return this.request<PricesResponse>("GET", "/api/prices");
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

  async openLease(request: {
    protocol: string;
    downpayment: CoinAmount;
    lease_currency: string;
    max_ltd?: string;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/leases/open", { body: request });
  }

  async repayLease(request: {
    lease_address: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/leases/repay", { body: request });
  }

  async closeLease(request: {
    lease_address: string;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/leases/close", { body: request });
  }

  async marketCloseLease(request: {
    lease_address: string;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/leases/market-close", { body: request });
  }

  // =========================================================================
  // Earn
  // =========================================================================

  async getEarnPools(): Promise<EarnPool[]> {
    return this.request<EarnPool[]>("GET", "/api/earn/pools");
  }

  async getEarnPool(poolId: string): Promise<EarnPool> {
    return this.request<EarnPool>("GET", `/api/earn/pools/${poolId}`);
  }

  async getEarnPositions(address: string): Promise<EarnPositionsResponse> {
    return this.request<EarnPositionsResponse>("GET", "/api/earn/positions", {
      params: { address },
    });
  }

  async getEarnStats(): Promise<EarnStats> {
    return this.request<EarnStats>("GET", "/api/earn/stats");
  }

  async earnDeposit(request: {
    protocol: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/earn/deposit", { body: request });
  }

  async earnWithdraw(request: {
    protocol: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/earn/withdraw", { body: request });
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

  async delegate(request: {
    validator_address: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/staking/delegate", { body: request });
  }

  async undelegate(request: {
    validator_address: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/staking/undelegate", { body: request });
  }

  async redelegate(request: {
    src_validator_address: string;
    dst_validator_address: string;
    amount: CoinAmount;
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/staking/redelegate", { body: request });
  }

  async claimStakingRewards(request: {
    validator_addresses: string[];
    sender_address: string;
  }): Promise<SwapMessage[]> {
    return this.request<SwapMessage[]>("POST", "/api/staking/claim-rewards", { body: request });
  }

  // =========================================================================
  // Swap
  // =========================================================================

  async getSwapQuote(request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    return this.request<SwapQuoteResponse>("GET", "/api/swap/quote", {
      params: {
        source_asset: request.source_asset,
        source_chain: request.source_chain,
        dest_asset: request.dest_asset,
        dest_chain: request.dest_chain,
        amount: request.amount,
      },
    });
  }

  async executeSwap(request: SwapExecuteRequest): Promise<SwapExecuteResponse> {
    return this.request<SwapExecuteResponse>("POST", "/api/swap/execute", { body: request });
  }

  async getSwapStatus(txHash: string): Promise<SwapStatusResponse> {
    return this.request("GET", `/api/swap/status/${txHash}`);
  }

  async getSwapHistory(address: string, skip?: number, limit?: number): Promise<TransactionHistoryEntry[]> {
    return this.request<TransactionHistoryEntry[]>("GET", "/api/swap/history", {
      params: { address, skip, limit },
    });
  }

  async getSupportedSwapPairs(): Promise<{ source: string; dest: string; chains: string[] }[]> {
    return this.request("GET", "/api/swap/supported-pairs");
  }

  // =========================================================================
  // Skip Route
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
  // Zero Interest
  // =========================================================================

  async getZeroInterestConfig(): Promise<ZeroInterestConfig> {
    return this.request<ZeroInterestConfig>("GET", "/api/zero-interest/config");
  }

  async checkZeroInterestEligibility(lease: string, owner: string): Promise<ZeroInterestEligibility> {
    return this.request<ZeroInterestEligibility>("GET", "/api/zero-interest/eligibility", {
      params: { lease, owner },
    });
  }

  async getZeroInterestPayments(owner: string): Promise<ZeroInterestPayment[]> {
    return this.request<ZeroInterestPayment[]>("GET", `/api/zero-interest/payments/${owner}`);
  }

  async getLeaseZeroInterestPayments(leaseAddress: string): Promise<ZeroInterestPayment[]> {
    return this.request<ZeroInterestPayment[]>("GET", `/api/zero-interest/lease/${leaseAddress}/payments`);
  }

  async createZeroInterestPayment(request: {
    lease_address: string;
    amount: string;
    denom: string;
    owner_address: string;
    signature: string;
  }): Promise<{ payment: ZeroInterestPayment; tx_hash?: string }> {
    return this.request("POST", "/api/zero-interest/payments", { body: request });
  }

  async cancelZeroInterestPayment(
    paymentId: string,
    request: { owner_address: string; signature: string }
  ): Promise<void> {
    return this.request("DELETE", `/api/zero-interest/payments/${paymentId}`, { body: request });
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
  // Intercom
  // =========================================================================

  async getIntercomHash(userId: string): Promise<IntercomHashResponse> {
    return this.request<IntercomHashResponse>("POST", "/api/intercom/hash", {
      body: { user_id: userId },
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
  // Health
  // =========================================================================

  async healthCheck(): Promise<{ status: string; version: string; uptime_seconds: number }> {
    return this.request("GET", "/api/health");
  }

  // =========================================================================
  // Webapp Configuration
  // =========================================================================

  async getWebappConfig(): Promise<WebappFullConfig> {
    return this.request<WebappFullConfig>("GET", "/api/webapp/config");
  }

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

  async getWebappEndpoints(): Promise<WebappEndpointsCollection> {
    return this.request<WebappEndpointsCollection>("GET", "/api/webapp/config/endpoints");
  }

  async getWebappNetworkEndpoints(network: string): Promise<WebappNetworkEndpointsConfig> {
    return this.request<WebappNetworkEndpointsConfig>("GET", `/api/webapp/config/endpoints/${network}`);
  }

  async getWebappDownpaymentRanges(): Promise<WebappDownpaymentRangesConfig> {
    return this.request<WebappDownpaymentRangesConfig>("GET", "/api/webapp/config/lease/downpayment-ranges");
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

  async getWebappLocales(): Promise<WebappLocalesListResponse> {
    return this.request<WebappLocalesListResponse>("GET", "/api/webapp/locales");
  }

  async getWebappLocale(lang: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", `/api/webapp/locales/${lang}`);
  }
}

// Export singleton instance
export const BackendApi = new BackendApiClient();
