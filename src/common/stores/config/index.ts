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
  type AssetsResponse,
  type AssetInfo
} from "@/common/api";

const CONFIG_STORAGE_KEY = "nolus_config_cache";
const CURRENCIES_STORAGE_KEY = "nolus_currencies_cache";
const ASSETS_STORAGE_KEY = "nolus_assets_cache";
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

  // Assets from /api/assets (deduplicated with network mappings)
  const assetsResponse = ref<AssetsResponse | null>(null);

  // Loading states
  const loading = ref(false);
  const currenciesLoading = ref(false);
  const assetsLoading = ref(false);
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

  function loadAssetsFromCache(): boolean {
    try {
      const cached = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        assetsResponse.value = data;
        return true;
      }
    } catch (e) {
      console.warn("[ConfigStore] Failed to load assets from cache:", e);
    }
    return false;
  }

  function saveAssetsToCache(): void {
    try {
      const cacheData = { data: assetsResponse.value, timestamp: Date.now() };
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[ConfigStore] Failed to save assets to cache:", e);
    }
  }

  // Auto-save to cache when data changes
  watch(
    config,
    () => {
      if (config.value) saveConfigToCache();
    },
    { deep: true }
  );

  watch(
    currenciesResponse,
    () => {
      if (currenciesResponse.value) saveCurrenciesToCache();
    },
    { deep: true }
  );

  watch(
    assetsResponse,
    () => {
      if (assetsResponse.value) saveAssetsToCache();
    },
    { deep: true }
  );

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

  /** Networks indexed by key for quick lookup */
  const supportedNetworksData = computed<{ [key: string]: NetworkInfo }>(() => {
    const result: { [key: string]: NetworkInfo } = {};
    for (const network of networks.value) {
      result[network.key] = network;
    }
    return result;
  });

  /** Get the native network (Nolus) */
  const nativeNetwork = computed<NetworkInfo | undefined>(() => {
    return networks.value.find((n) => n.native);
  });

  /**
   * Get active protocol keys grouped by network name (e.g., "Osmosis", "Neutron")
   * This is used to dynamically determine which protocols' currencies to show
   */
  const protocolsByNetwork = computed<{ [network: string]: string[] }>(() => {
    const result: { [network: string]: string[] } = {};
    for (const [key, protocol] of Object.entries(protocols.value)) {
      if (protocol.is_active && protocol.network) {
        const networkName = protocol.network.toUpperCase();
        if (!result[networkName]) {
          result[networkName] = [];
        }
        result[networkName].push(key);
      }
    }
    return result;
  });

  /**
   * Get all active protocol keys for a given network filter (e.g., "OSMOSIS", "NEUTRON")
   */
  function getActiveProtocolsForNetwork(networkFilter: string): string[] {
    return protocolsByNetwork.value[networkFilter] ?? [];
  }

  /**
   * Check if a network has any short-position protocols
   */
  function hasShortProtocols(networkFilter: string): boolean {
    const networkProtocols = getActiveProtocolsForNetwork(networkFilter);
    return networkProtocols.some((key) => {
      const protocol = protocols.value[key];
      return protocol?.position_type === "short";
    });
  }

  /**
   * Check if a network has any long-position protocols
   */
  function hasLongProtocols(networkFilter: string): boolean {
    const networkProtocols = getActiveProtocolsForNetwork(networkFilter);
    return networkProtocols.some((key) => {
      const protocol = protocols.value[key];
      return protocol?.position_type === "long";
    });
  }

  /**
   * Check if a network is disabled (no active protocols)
   */
  function isNetworkDisabled(networkFilter: string): boolean {
    const networkProtocols = getActiveProtocolsForNetwork(networkFilter);
    return networkProtocols.length === 0;
  }

  // ==========================================================================
  // Computed - Currencies
  // ==========================================================================

  /** All currencies indexed by key */
  const currenciesData = computed<{ [key: string]: CurrencyInfo }>(() => currenciesResponse.value?.currencies ?? {});

  /** LPN currencies (one per protocol) */
  const lpn = computed<CurrencyInfo[]>(() => currenciesResponse.value?.lpn ?? []);

  /** Lease-able currency tickers */
  const leaseCurrencies = computed<string[]>(() => currenciesResponse.value?.lease_currencies ?? []);

  /** Currency key mappings (aliases) */
  const currencyMap = computed<{ [key: string]: string }>(() => currenciesResponse.value?.map ?? {});

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
  // Computed - Assets
  // ==========================================================================

  /** All assets from /api/assets */
  const assets = computed<AssetInfo[]>(() => assetsResponse.value?.assets ?? []);

  /** Assets indexed by ticker */
  const assetsByTicker = computed<{ [ticker: string]: AssetInfo }>(() => {
    const result: { [ticker: string]: AssetInfo } = {};
    for (const asset of assets.value) {
      result[asset.ticker] = asset;
    }
    return result;
  });

  /**
   * Get asset tickers available for a network (e.g., "Osmosis", "Neutron")
   * This is the source of truth for which assets to show in the UI
   */
  const assetTickersByNetwork = computed<{ [network: string]: string[] }>(() => {
    const result: { [network: string]: string[] } = {};
    for (const asset of assets.value) {
      for (const network of asset.networks) {
        if (!result[network]) {
          result[network] = [];
        }
        result[network].push(asset.ticker);
      }
    }
    return result;
  });

  /** Check if assets are loaded */
  const hasAssets = computed(() => assets.value.length > 0);

  // ==========================================================================
  // Getters - Assets
  // ==========================================================================

  /** Get asset info by ticker */
  function getAsset(ticker: string): AssetInfo | undefined {
    return assetsByTicker.value[ticker];
  }

  /** Get all asset tickers for the current network (from fetched assets) */
  function getAssetTickersForNetwork(networkFilter: string): string[] {
    // Assets are fetched per-network via /api/networks/{network}/assets
    // So all assets in the response belong to the current network
    return assets.value.map((a) => a.ticker);
  }

  /** Check if a ticker is available for a network */
  function isAssetAvailableForNetwork(ticker: string, networkFilter: string): boolean {
    const tickers = getAssetTickersForNetwork(networkFilter);
    return tickers.includes(ticker);
  }

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

  /** Get network by prefix (e.g., "nolus", "osmo") */
  function getNetworkByPrefix(prefix: string): NetworkInfo | undefined {
    return networks.value.find((n) => n.prefix === prefix);
  }

  /** Get network by value (e.g., "nolus", "osmosis") */
  function getNetworkByValue(value: string): NetworkInfo | undefined {
    return networks.value.find((n) => n.value === value.toLowerCase());
  }

  /** Get the network name for a protocol key (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE" -> "Osmosis") */
  function getNetworkNameByProtocol(protocolKey: string): string | undefined {
    const protocol = protocols.value[protocolKey];
    return protocol?.network ?? undefined;
  }

  /** Get the network filter (uppercase) for a protocol key (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE" -> "OSMOSIS") */
  function getNetworkFilterByProtocol(protocolKey: string): string | undefined {
    const networkName = getNetworkNameByProtocol(protocolKey);
    return networkName?.toUpperCase();
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
    return Object.values(currenciesData.value).filter((c) => c.protocol === protocol);
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

  async function fetchAssets(): Promise<void> {
    assetsLoading.value = true;

    try {
      assetsResponse.value = await BackendApi.getAssets();
    } catch (e) {
      console.error("[ConfigStore] Failed to fetch assets:", e);
      throw e;
    } finally {
      assetsLoading.value = false;
    }
  }

  /**
   * Fetch assets for a specific network using /api/networks/{network}/assets
   */
  async function fetchNetworkAssets(network: string): Promise<void> {
    assetsLoading.value = true;

    try {
      assetsResponse.value = await BackendApi.getNetworkAssets(network);
    } catch (e) {
      console.error("[ConfigStore] Failed to fetch network assets:", e);
      throw e;
    } finally {
      assetsLoading.value = false;
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
    const hadAssetsCache = loadAssetsFromCache();

    // Determine which network to fetch assets for
    const networkToFetch = protocolFilter.value || "OSMOSIS";

    if (hadConfigCache && hadCurrenciesCache && hadAssetsCache) {
      initialized.value = true;
      // Background refresh - don't block
      Promise.all([fetchConfig(), fetchCurrencies(), fetchNetworkAssets(networkToFetch)]).catch((e) => {
        console.error("[ConfigStore] Background refresh failed:", e);
      });
    } else {
      // No cache - must wait for fresh data
      await Promise.all([fetchConfig(), fetchCurrencies(), fetchNetworkAssets(networkToFetch)]);
      initialized.value = true;
    }
  }

  // Watch for protocol filter changes and refetch assets for the new network
  watch(protocolFilter, async (newFilter) => {
    if (initialized.value && newFilter) {
      await fetchNetworkAssets(newFilter);
    }
  });

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
    assetsResponse,
    loading,
    currenciesLoading,
    assetsLoading,
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
    supportedNetworksData,
    nativeNetwork,
    protocolsByNetwork,

    // Getters - Protocols
    getActiveProtocolsForNetwork,
    hasShortProtocols,
    hasLongProtocols,
    isNetworkDisabled,

    // Computed - Currencies
    currenciesData,
    lpn,
    leaseCurrencies,
    currencyMap,
    native,
    hasCurrencies,

    // Computed - Assets
    assets,
    assetsByTicker,
    assetTickersByNetwork,
    hasAssets,

    // Getters - Assets
    getAsset,
    getAssetTickersForNetwork,
    isAssetAvailableForNetwork,

    // Getters - Protocols & Networks
    getProtocol,
    getNetwork,
    getNetworkByChainId,
    getNetworkByPrefix,
    getNetworkByValue,
    getNetworkNameByProtocol,
    getNetworkFilterByProtocol,
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
    fetchAssets,
    fetchNetworkAssets,
    initialize,
    refresh
  };
});
