/**
 * Campaigns Store - Zero-interest campaign data from Payments Manager
 *
 * Fetches active zero-interest campaigns and provides eligibility checking.
 * Used to display campaign badges and eligibility indicators in the UI.
 *
 * Uses localStorage for caching to provide instant loading.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  BackendApi,
  type ActiveCampaignsResponse,
  type ZeroInterestCampaign,
  type CampaignEligibilityResponse,
} from "@/common/api";

const STORAGE_KEY = "nolus_campaigns_cache";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export const useCampaignsStore = defineStore("campaigns", () => {
  // State
  const campaigns = ref<ZeroInterestCampaign[]>([]);
  const allEligibleCurrencies = ref<string[]>([]);
  const allEligibleProtocols = ref<string[]>([]);
  const hasUniversalCampaign = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Computed
  const campaignCount = computed(() => campaigns.value.length);
  const hasCampaigns = computed(() => campaigns.value.length > 0);

  /**
   * Load cached campaigns from localStorage
   */
  function loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        campaigns.value = data.campaigns || [];
        allEligibleCurrencies.value = data.all_eligible_currencies || [];
        allEligibleProtocols.value = data.all_eligible_protocols || [];
        hasUniversalCampaign.value = data.has_universal_campaign || false;
        lastUpdated.value = new Date(timestamp);
        return true;
      }
    } catch (e) {
      console.warn("[CampaignsStore] Failed to load from cache:", e);
    }
    return false;
  }

  /**
   * Save campaigns to localStorage
   */
  function saveToCache(data: ActiveCampaignsResponse): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[CampaignsStore] Failed to save to cache:", e);
    }
  }

  /**
   * Fetch active campaigns from backend
   */
  async function fetchCampaigns(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await BackendApi.getActiveCampaigns();
      campaigns.value = response.campaigns;
      allEligibleCurrencies.value = response.all_eligible_currencies;
      allEligibleProtocols.value = response.all_eligible_protocols;
      hasUniversalCampaign.value = response.has_universal_campaign;
      lastUpdated.value = new Date();
      saveToCache(response);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch campaigns";
      console.error("[CampaignsStore] Failed to fetch campaigns:", e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Check if a currency is eligible for any campaign
   * Quick check using aggregated data - doesn't call API
   */
  function isCurrencyEligible(currency: string): boolean {
    // If there's a universal campaign, everything is eligible
    if (hasUniversalCampaign.value) {
      return true;
    }
    // If no campaigns, nothing is eligible
    if (campaigns.value.length === 0) {
      return false;
    }
    // Check if currency is in the aggregated list
    // Empty list means all currencies are eligible for at least one campaign
    if (allEligibleCurrencies.value.length === 0) {
      return true;
    }
    return allEligibleCurrencies.value.includes(currency);
  }

  /**
   * Check if a protocol is eligible for any campaign
   * Quick check using aggregated data - doesn't call API
   */
  function isProtocolEligible(protocol: string): boolean {
    if (hasUniversalCampaign.value) {
      return true;
    }
    if (campaigns.value.length === 0) {
      return false;
    }
    if (allEligibleProtocols.value.length === 0) {
      return true;
    }
    return allEligibleProtocols.value.includes(protocol);
  }

  /**
   * Check if a currency/protocol combination is eligible for zero-interest
   * This is a local check - for full eligibility including wallet, use checkFullEligibility
   */
  function isEligible(currency: string, protocol?: string): boolean {
    if (hasUniversalCampaign.value) {
      return true;
    }
    if (campaigns.value.length === 0) {
      return false;
    }

    // Check each campaign
    return campaigns.value.some((campaign) => {
      // Check currency eligibility
      const currencyMatch =
        campaign.eligible_currencies.length === 0 ||
        campaign.eligible_currencies.includes(currency);

      // Check protocol eligibility (if protocol provided)
      const protocolMatch =
        !protocol ||
        campaign.eligible_protocols.length === 0 ||
        campaign.eligible_protocols.includes(protocol);

      return currencyMatch && protocolMatch;
    });
  }

  /**
   * Get campaigns that match a currency/protocol
   */
  function getMatchingCampaigns(
    currency: string,
    protocol?: string
  ): ZeroInterestCampaign[] {
    return campaigns.value.filter((campaign) => {
      const currencyMatch =
        campaign.eligible_currencies.length === 0 ||
        campaign.eligible_currencies.includes(currency);

      const protocolMatch =
        !protocol ||
        campaign.eligible_protocols.length === 0 ||
        campaign.eligible_protocols.includes(protocol);

      return currencyMatch && protocolMatch;
    });
  }

  /**
   * Check full eligibility including wallet address (calls API)
   * Use this for final eligibility check before showing zero-interest badge
   */
  async function checkFullEligibility(
    wallet: string,
    protocol?: string,
    currency?: string
  ): Promise<CampaignEligibilityResponse> {
    try {
      return await BackendApi.checkCampaignEligibility(wallet, protocol, currency);
    } catch (e) {
      console.error("[CampaignsStore] Failed to check eligibility:", e);
      return {
        eligible: false,
        matching_campaigns: [],
        reason: e instanceof Error ? e.message : "Failed to check eligibility",
      };
    }
  }

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    const hadCache = loadFromCache();

    if (hadCache) {
      // Background refresh
      fetchCampaigns().catch((e) => {
        console.error("[CampaignsStore] Background refresh failed:", e);
      });
    } else {
      await fetchCampaigns();
    }
  }

  /**
   * Cleanup store state
   */
  function cleanup(): void {
    campaigns.value = [];
    allEligibleCurrencies.value = [];
    allEligibleProtocols.value = [];
    hasUniversalCampaign.value = false;
    error.value = null;
    lastUpdated.value = null;
  }

  return {
    // State
    campaigns,
    allEligibleCurrencies,
    allEligibleProtocols,
    hasUniversalCampaign,
    loading,
    error,
    lastUpdated,

    // Computed
    campaignCount,
    hasCampaigns,

    // Local checks (no API call)
    isCurrencyEligible,
    isProtocolEligible,
    isEligible,
    getMatchingCampaigns,

    // API calls
    fetchCampaigns,
    checkFullEligibility,

    // Lifecycle
    initialize,
    cleanup,
  };
});
