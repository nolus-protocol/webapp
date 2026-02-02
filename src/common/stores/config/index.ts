/**
 * Config Store - Application configuration from backend
 *
 * Provides protocol contract addresses and network information.
 * Currency data is loaded separately from static configuration.
 *
 * Uses localStorage for optimistic loading - config rarely changes,
 * so cached data is usually valid.
 */

import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import {
  BackendApi,
  type AppConfigResponse,
  type ProtocolInfo,
  type NetworkInfo,
  type NativeAssetInfo,
  type ProtocolContracts,
} from "@/common/api";
import { useApplicationStore } from "../application";
import type { ExternalCurrency } from "@/common/types";

const STORAGE_KEY = "nolus_config_cache";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour - config rarely changes

export const useConfigStore = defineStore("config", () => {
  // State
  const config = ref<AppConfigResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  /**
   * Load cached config from localStorage
   */
  function loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        config.value = data;
        return true;
      }
    } catch (e) {
      console.warn("[ConfigStore] Failed to load from cache:", e);
    }
    return false;
  }

  /**
   * Save config to localStorage
   */
  function saveToCache(): void {
    try {
      const cacheData = {
        data: config.value,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[ConfigStore] Failed to save to cache:", e);
    }
  }

  // Auto-save to cache when config changes
  watch(config, () => {
    if (config.value) {
      saveToCache();
    }
  }, { deep: true });

  // Computed
  const protocols = computed<{ [key: string]: ProtocolInfo }>(() => config.value?.protocols ?? {});
  const networks = computed<NetworkInfo[]>(() => config.value?.networks ?? []);
  const nativeAsset = computed<NativeAssetInfo | null>(() => config.value?.native_asset ?? null);

  const protocolKeys = computed(() => Object.keys(protocols.value));
  const protocolCount = computed(() => protocolKeys.value.length);

  // Contracts lookup - provides { [protocolKey]: { oracle, lpp, leaser, profit } }
  const contracts = computed(() => {
    const result: { [key: string]: ProtocolContracts } = {};
    for (const [key, protocol] of Object.entries(protocols.value)) {
      result[key] = protocol.contracts;
    }
    return result;
  });

  // Network lookup
  const networkByKey = computed(() => {
    const map = new Map<string, NetworkInfo>();
    networks.value.forEach((n) => map.set(n.key, n));
    return map;
  });

  const networkByChainId = computed(() => {
    const map = new Map<string, NetworkInfo>();
    networks.value.forEach((n) => map.set(n.chain_id, n));
    return map;
  });

  /**
   * Get protocol by key
   */
  function getProtocol(key: string): ProtocolInfo | undefined {
    return protocols.value[key];
  }

  /**
   * Get network by key
   */
  function getNetwork(key: string): NetworkInfo | undefined {
    return networkByKey.value.get(key);
  }

  /**
   * Get network by chain ID
   */
  function getNetworkByChainId(chainId: string): NetworkInfo | undefined {
    return networkByChainId.value.get(chainId);
  }

  /**
   * Get protocol contracts
   */
  function getContracts(protocol: string): ProtocolContracts | undefined {
    return contracts.value[protocol];
  }

  /**
   * Get currency by ticker (e.g., "USDC_NOBLE", "AKT")
   * Delegates to application store's currenciesData
   */
  function getCurrency(ticker: string): ExternalCurrency | undefined {
    const application = useApplicationStore();
    if (!application.currenciesData) return undefined;
    
    for (const key in application.currenciesData) {
      const [t] = key.split("@");
      if (t === ticker) {
        return application.currenciesData[key];
      }
    }
    return undefined;
  }

  /**
   * Get currency by ticker (alias for getCurrency)
   */
  function getCurrencyByTicker(ticker: string): ExternalCurrency | undefined {
    return getCurrency(ticker);
  }

  /**
   * Fetch configuration from backend
   */
  async function fetchConfig(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      config.value = await BackendApi.getConfig();
      initialized.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch config";
      console.error("[ConfigStore] Failed to fetch config:", e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Initialize the store - load cache immediately, then refresh in background
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }

    // Load cached config immediately
    const hadCache = loadFromCache();
    if (hadCache) {
      initialized.value = true;
      // Background refresh - don't block
      fetchConfig().catch((e) => {
        console.error("[ConfigStore] Background refresh failed:", e);
      });
    } else {
      // No cache - must wait for fresh data
      await fetchConfig();
    }
  }

  /**
   * Refresh configuration
   */
  async function refresh(): Promise<void> {
    await fetchConfig();
  }

  return {
    // State
    config,
    loading,
    error,
    initialized,

    // Computed
    protocols,
    networks,
    nativeAsset,
    protocolKeys,
    protocolCount,
    contracts,

    // Getters
    getProtocol,
    getNetwork,
    getNetworkByChainId,
    getContracts,
    getCurrency,
    getCurrencyByTicker,

    // Actions
    fetchConfig,
    initialize,
    refresh,
  };
});
