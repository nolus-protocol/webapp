/**
 * Config Store - Application configuration from backend
 *
 * Provides:
 * - Protocol contract addresses and network information
 * - Currency data (replaces useApplicationStore.currenciesData)
 * - Protocol filter (replaces useApplicationStore.protocolFilter)
 * - Network selection
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
  type CurrenciesResponse,
  type CurrencyInfo,
} from "@/common/api";

const CONFIG_STORAGE_KEY = "nolus_config_cache";
const CURRENCIES_STORAGE_KEY = "nolus_currencies_cache";
const PROTOCOL_FILTER_KEY = "protocol_filter";
const SELECTED_NETWORK_KEY = "selected_network";
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export const useConfigStore = defineStore("config", () => {
  // ==========================================================================
  // State
  // ==========================================================================
  
  // Core config from /api/config
  const config = ref<AppConfigResponse | null>(null);
  
  // Currencies from /api/currencies
  const currenciesResponse = ref<CurrenciesResponse | null>(null);
  
  // Loading states
  const loading = ref(false);
  const currenciesLoading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);
  
  // User preferences
  const protocolFilter = ref<string>(localStorage.getItem(PROTOCOL_FILTER_KEY) || "");
  const selectedNetwork = ref<string>(localStorage.getItem(SELECTED_NETWORK_KEY) || "mainnet");

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  function loadConfigFromCache(): boolean {
    try {
      const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        config.value = data;
        return true;
      }
    } catch (e) {
      console.warn("[ConfigStore] Failed to load config from cache:", e);
    }
    return false;
  }

  function loadCurrenciesFromCache(): boolean {
    try {
      const cached = localStorage.getItem(CURRENCIES_STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        currenciesResponse.value = data;
        return true;
      }
    } catch (e) {
      console.warn("[ConfigStore] Failed to load currencies from cache:", e);
    }
    return false;
  }

  function saveConfigToCache(): void {
    try {
      const cacheData = { data: config.value, timestamp: Date.now() };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[ConfigStore] Failed to save config to cache:", e);
    }
  }

  function saveCurrenciesToCache(): void {
    try {
      const cacheData = { data: currenciesResponse.value, timestamp: Date.now() };
      localStorage.setItem(CURRENCIES_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[ConfigStore] Failed to save currencies to cache:", e);
    }
  }

  // Auto-save to cache when data changes
  watch(config, () => {
    if (config.value) saveConfigToCache();
  }, { deep: true });

  watch(currenciesResponse, () => {
    if (currenciesResponse.value) saveCurrenciesToCache();
  }, { deep: true });

  // Persist user preferences
  watch(protocolFilter, (val) => {
    if (val) {
      localStorage.setItem(PROTOCOL_FILTER_KEY, val);
    } else {
      localStorage.removeItem(PROTOCOL_FILTER_KEY);
    }
  });

  watch(selectedNetwork, (val) => {
    localStorage.setItem(SELECTED_NETWORK_KEY, val);
  });

  // ==========================================================================
  // Computed - Protocols & Networks
  // ==========================================================================

  const protocols = computed<{ [key: string]: ProtocolInfo }>(() => config.value?.protocols ?? {});
  const networks = computed<NetworkInfo[]>(() => config.value?.networks ?? []);
  const nativeAsset = computed<NativeAssetInfo | null>(() => config.value?.native_asset ?? null);

  const protocolKeys = computed(() => Object.keys(protocols.value));
  const protocolCount = computed(() => protocolKeys.value.length);

  const contracts = computed(() => {
    const result: { [key: string]: ProtocolContracts } = {};
    for (const [key, protocol] of Object.entries(protocols.value)) {
      result[key] = protocol.contracts;
    }
    return result;
  });

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

  // ==========================================================================
  // Computed - Currencies
  // ==========================================================================

  /** All currencies indexed by key */
  const currenciesData = computed<{ [key: string]: CurrencyInfo }>(() => 
    currenciesResponse.value?.currencies ?? {}
  );

  /** LPN currencies (one per protocol) */
  const lpn = computed<CurrencyInfo[]>(() => 
    currenciesResponse.value?.lpn ?? []
  );

  /** Lease-able currency tickers */
  const leaseCurrencies = computed<string[]>(() => 
    currenciesResponse.value?.lease_currencies ?? []
  );

  /** Currency key mappings (aliases) */
  const currencyMap = computed<{ [key: string]: string }>(() => 
    currenciesResponse.value?.map ?? {}
  );

  /** Native currency (NLS) */
  const native = computed<CurrencyInfo | undefined>(() => {
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.native) return currency;
    }
    return undefined;
  });

  /** Check if currencies are loaded */
  const hasCurrencies = computed(() => Object.keys(currenciesData.value).length > 0);

  // ==========================================================================
  // Getters - Protocols & Networks
  // ==========================================================================

  function getProtocol(key: string): ProtocolInfo | undefined {
    return protocols.value[key];
  }

  function getNetwork(key: string): NetworkInfo | undefined {
    return networkByKey.value.get(key);
  }

  function getNetworkByChainId(chainId: string): NetworkInfo | undefined {
    return networkByChainId.value.get(chainId);
  }

  function getContracts(protocol: string): ProtocolContracts | undefined {
    return contracts.value[protocol];
  }

  // ==========================================================================
  // Getters - Currencies (replaces CurrencyLookup.ts functions)
  // ==========================================================================

  /** Get currency by key (TICKER@PROTOCOL) */
  function getCurrencyByKey(key: string): CurrencyInfo | undefined {
    return currenciesData.value[key];
  }

  /** Get currency by ticker (first match across protocols) */
  function getCurrencyByTicker(ticker: string): CurrencyInfo | undefined {
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.ticker === ticker) return currency;
    }
    return undefined;
  }

  /** Get currency by IBC denom */
  function getCurrencyByDenom(denom: string): CurrencyInfo | undefined {
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.ibcData === denom) return currency;
    }
    return undefined;
  }

  /** Get currency by symbol */
  function getCurrencyBySymbol(symbol: string): CurrencyInfo | undefined {
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.symbol === symbol) return currency;
    }
    return undefined;
  }

  /** Get currency by denom and protocol */
  function getCurrency(denom: string, protocol: string): CurrencyInfo | undefined {
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.ibcData === denom && currency.protocol === protocol) {
        return currency;
      }
    }
    return undefined;
  }

  /** Try to get currency by denom, returns null instead of throwing */
  function tryGetCurrencyByDenom(denom: string): CurrencyInfo | null {
    return getCurrencyByDenom(denom) ?? null;
  }

  /** Try to get currency by ticker, returns null instead of throwing */
  function tryGetCurrencyByTicker(ticker: string): CurrencyInfo | null {
    return getCurrencyByTicker(ticker) ?? null;
  }

  /** Get native currency */
  function getNativeCurrency(): CurrencyInfo | undefined {
    return native.value;
  }

  /** Get LPN currency for a protocol */
  function getLpnByProtocol(protocol: string): CurrencyInfo | null {
    for (const lpnCurrency of lpn.value) {
      if (lpnCurrency.protocol === protocol) return lpnCurrency;
    }
    return null;
  }

  /** Get all currencies for a protocol */
  function getCurrenciesByProtocol(protocol: string): CurrencyInfo[] {
    return Object.values(currenciesData.value).filter(c => c.protocol === protocol);
  }

  /** Get all currencies as array */
  function getAllCurrencies(): CurrencyInfo[] {
    return Object.values(currenciesData.value);
  }

  /** Get currencies indexed by key for a specific protocol/network */
  function getCurrenciesForNetwork(networkKey: string): { [key: string]: CurrencyInfo } {
    const result: { [key: string]: CurrencyInfo } = {};
    for (const [key, currency] of Object.entries(currenciesData.value)) {
      if (currency.protocol === networkKey) {
        result[key] = currency;
      }
    }
    return result;
  }

  /** Get protocol name by contract address */
  function getProtocolByContract(contractAddress: string): string | undefined {
    for (const [protocolKey, protocolContracts] of Object.entries(contracts.value)) {
      if (
        protocolContracts.oracle === contractAddress ||
        protocolContracts.lpp === contractAddress ||
        protocolContracts.leaser === contractAddress ||
        protocolContracts.profit === contractAddress
      ) {
        return protocolKey;
      }
    }
    return undefined;
  }

  // ==========================================================================
  // Actions - Protocol Filter
  // ==========================================================================

  function setProtocolFilter(filter: string): void {
    protocolFilter.value = filter;
  }

  function clearProtocolFilter(): void {
    protocolFilter.value = "";
  }

  // ==========================================================================
  // Actions - Network Selection
  // ==========================================================================

  function setSelectedNetwork(network: string): void {
    selectedNetwork.value = network;
  }

  // ==========================================================================
  // Actions - Fetch Data
  // ==========================================================================

  async function fetchConfig(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      config.value = await BackendApi.getConfig();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch config";
      console.error("[ConfigStore] Failed to fetch config:", e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCurrencies(): Promise<void> {
    currenciesLoading.value = true;

    try {
      currenciesResponse.value = await BackendApi.getCurrencies();
    } catch (e) {
      console.error("[ConfigStore] Failed to fetch currencies:", e);
      throw e;
    } finally {
      currenciesLoading.value = false;
    }
  }

  /**
   * Initialize the store - load cache immediately, then refresh in background
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;

    // Load cached data immediately for fast UI
    const hadConfigCache = loadConfigFromCache();
    const hadCurrenciesCache = loadCurrenciesFromCache();

    if (hadConfigCache && hadCurrenciesCache) {
      initialized.value = true;
      // Background refresh - don't block
      Promise.all([fetchConfig(), fetchCurrencies()]).catch((e) => {
        console.error("[ConfigStore] Background refresh failed:", e);
      });
    } else {
      // No cache - must wait for fresh data
      await Promise.all([fetchConfig(), fetchCurrencies()]);
      initialized.value = true;
    }
  }

  /**
   * Refresh all configuration
   */
  async function refresh(): Promise<void> {
    await Promise.all([fetchConfig(), fetchCurrencies()]);
  }

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    config,
    currenciesResponse,
    loading,
    currenciesLoading,
    error,
    initialized,
    protocolFilter,
    selectedNetwork,

    // Computed - Protocols & Networks
    protocols,
    networks,
    nativeAsset,
    protocolKeys,
    protocolCount,
    contracts,

    // Computed - Currencies
    currenciesData,
    lpn,
    leaseCurrencies,
    currencyMap,
    native,
    hasCurrencies,

    // Getters - Protocols & Networks
    getProtocol,
    getNetwork,
    getNetworkByChainId,
    getContracts,

    // Getters - Currencies
    getCurrencyByKey,
    getCurrencyByTicker,
    getCurrencyByDenom,
    getCurrencyBySymbol,
    getCurrency,
    tryGetCurrencyByDenom,
    tryGetCurrencyByTicker,
    getNativeCurrency,
    getLpnByProtocol,
    getCurrenciesByProtocol,
    getAllCurrencies,
    getCurrenciesForNetwork,
    getProtocolByContract,

    // Actions - Protocol Filter
    setProtocolFilter,
    clearProtocolFilter,

    // Actions - Network
    setSelectedNetwork,

    // Actions - Fetch
    fetchConfig,
    fetchCurrencies,
    initialize,
    refresh,
  };
});
