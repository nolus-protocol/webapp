/**
 * Config Store - Application configuration from backend
 *
 * Provides:
 * - Protocol contract addresses and network information
 * - Currency data (replaces useApplicationStore.currenciesData)
 * - Protocol filter (replaces useApplicationStore.protocolFilter)
 * - Network selection
 *
 * Browser HTTP cache (Cache-Control: max-age=3600, stale-while-revalidate=1800)
 * handles caching at the network layer. User preferences (protocol filter,
 * selected network) are persisted to localStorage.
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
  type AssetInfo,
  type GatedProtocolsResponse,
  type GatedProtocolInfo,
  type ProtocolCurrenciesResponse,
  type ProtocolCurrencyInfo,
  type GasFeeConfigResponse
} from "@/common/api";

const PROTOCOL_FILTER_KEY = "protocol_filter";
const SELECTED_NETWORK_KEY = "selected_network";

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

  // Gated protocols from /api/protocols/gated
  const gatedProtocolsResponse = ref<GatedProtocolsResponse | null>(null);

  // Protocol currencies cache - keyed by protocol name
  const protocolCurrenciesCache = ref<{ [protocol: string]: ProtocolCurrenciesResponse }>({});

  // Gas fee config from /api/fees/gas-config
  const gasFeeConfig = ref<GasFeeConfigResponse | null>(null);

  // Loading states
  const loading = ref(false);
  const currenciesLoading = ref(false);
  const assetsLoading = ref(false);
  const gatedProtocolsLoading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  // User preferences
  const protocolFilter = ref<string>(localStorage.getItem(PROTOCOL_FILTER_KEY) || "");
  const selectedNetwork = ref<string>(localStorage.getItem(SELECTED_NETWORK_KEY) || "mainnet");

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

  /** Asset icons indexed by "TICKER@PROTOCOL" key */
  const assetIcons = computed<{ [key: string]: string }>(() => {
    const result: { [key: string]: string } = {};
    for (const asset of assets.value) {
      for (const protocol of asset.protocols) {
        result[`${asset.ticker}@${protocol}`] = asset.icon;
      }
    }
    return result;
  });

  /** Check if assets are loaded */
  const hasAssets = computed(() => assets.value.length > 0);

  // ==========================================================================
  // Computed - Gated Protocols
  // ==========================================================================

  /** All gated protocols */
  const gatedProtocols = computed<GatedProtocolInfo[]>(() => gatedProtocolsResponse.value?.protocols ?? []);

  /** Gated protocols indexed by protocol name */
  const gatedProtocolsByName = computed<{ [protocol: string]: GatedProtocolInfo }>(() => {
    const result: { [protocol: string]: GatedProtocolInfo } = {};
    for (const protocol of gatedProtocols.value) {
      result[protocol.protocol] = protocol;
    }
    return result;
  });

  /** Gated protocols grouped by network (uppercase key) */
  const gatedProtocolsByNetwork = computed<{ [network: string]: GatedProtocolInfo[] }>(() => {
    const result: { [network: string]: GatedProtocolInfo[] } = {};
    for (const protocol of gatedProtocols.value) {
      const networkKey = protocol.network.toUpperCase();
      if (!result[networkKey]) {
        result[networkKey] = [];
      }
      result[networkKey].push(protocol);
    }
    return result;
  });

  /** Long protocols for the current network filter */
  const longProtocolsForCurrentNetwork = computed<GatedProtocolInfo[]>(() => {
    const networkProtocols = gatedProtocolsByNetwork.value[protocolFilter.value] ?? [];
    return networkProtocols.filter((p) => p.position_type === "Long");
  });

  /** Short protocols for the current network filter */
  const shortProtocolsForCurrentNetwork = computed<GatedProtocolInfo[]>(() => {
    const networkProtocols = gatedProtocolsByNetwork.value[protocolFilter.value] ?? [];
    return networkProtocols.filter((p) => p.position_type === "Short");
  });

  /** Check if gated protocols are loaded */
  const hasGatedProtocols = computed(() => gatedProtocols.value.length > 0);

  // ==========================================================================
  // Getters - Gated Protocols
  // ==========================================================================

  /** Get gated protocol by name */
  function getGatedProtocol(protocol: string): GatedProtocolInfo | undefined {
    return gatedProtocolsByName.value[protocol];
  }

  /** Get long protocols for a network */
  function getLongProtocolsForNetwork(network: string): GatedProtocolInfo[] {
    const networkProtocols = gatedProtocolsByNetwork.value[network.toUpperCase()] ?? [];
    return networkProtocols.filter((p) => p.position_type === "Long");
  }

  /** Get short protocols for a network */
  function getShortProtocolsForNetwork(network: string): GatedProtocolInfo[] {
    const networkProtocols = gatedProtocolsByNetwork.value[network.toUpperCase()] ?? [];
    return networkProtocols.filter((p) => p.position_type === "Short");
  }

  /** Get currencies for a protocol (from cache or fetch) */
  async function getProtocolCurrencies(protocol: string): Promise<ProtocolCurrencyInfo[]> {
    // Check cache first
    if (protocolCurrenciesCache.value[protocol]) {
      return protocolCurrenciesCache.value[protocol].currencies;
    }

    // Fetch from API
    try {
      const response = await BackendApi.getProtocolCurrencies(protocol);
      protocolCurrenciesCache.value[protocol] = response;
      return response.currencies;
    } catch (e) {
      console.error(`[ConfigStore] Failed to fetch currencies for protocol ${protocol}:`, e);
      return [];
    }
  }

  /** Get cached protocol currencies (synchronous, returns empty if not cached) */
  function getCachedProtocolCurrencies(protocol: string): ProtocolCurrencyInfo[] {
    return protocolCurrenciesCache.value[protocol]?.currencies ?? [];
  }

  /** Get lease currencies for a protocol (group === "lease") */
  async function getLeaseCurrenciesForProtocol(protocol: string): Promise<ProtocolCurrencyInfo[]> {
    const currencies = await getProtocolCurrencies(protocol);
    return currencies.filter((c) => c.group === "lease");
  }

  /** Get collateral currencies for a protocol (all currencies that can be used as down payment) */
  async function getCollateralCurrenciesForProtocol(protocol: string): Promise<ProtocolCurrencyInfo[]> {
    const currencies = await getProtocolCurrencies(protocol);
    // Collateral includes lease currencies + lpn + native (anything user can pay with)
    return currencies.filter((c) => c.group === "lease" || c.group === "lpn" || c.group === "native");
  }

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

  /** Get network icon by network key (e.g., "OSMOSIS" -> "/icons/networks/osmosis.svg") */
  function getNetworkIcon(networkKey: string): string | undefined {
    // Try by key first
    const network = networkByKey.value.get(networkKey);
    if (network?.icon) return network.icon;

    // Try case-insensitive match
    for (const n of networks.value) {
      if (n.key.toUpperCase() === networkKey.toUpperCase()) {
        return n.icon;
      }
    }
    return undefined;
  }

  /** Get network icon for a protocol (looks up protocol's network, then network's icon) */
  function getNetworkIconByProtocol(protocolKey: string): string | undefined {
    const networkFilter = getNetworkFilterByProtocol(protocolKey);
    if (!networkFilter) return undefined;
    return getNetworkIcon(networkFilter);
  }

  /** Get position type for a protocol ("Long" | "Short") */
  function getPositionType(protocolKey: string): "Long" | "Short" {
    // Try gated protocols first (preferred source)
    const gatedProtocol = gatedProtocolsByName.value[protocolKey];
    if (gatedProtocol) {
      return gatedProtocol.position_type;
    }

    // Fall back to /api/config protocols
    const protocol = protocols.value[protocolKey];
    if (protocol?.position_type) {
      // Normalize to capitalized format
      const type = protocol.position_type.toLowerCase();
      return type === "short" ? "Short" : "Long";
    }

    // Default to Long
    return "Long";
  }

  /** Check if a protocol is a short position type */
  function isShortPosition(protocolKey: string): boolean {
    return getPositionType(protocolKey) === "Short";
  }

  /** Check if a protocol is a long position type */
  function isLongPosition(protocolKey: string): boolean {
    return getPositionType(protocolKey) === "Long";
  }

  /** Get available network filters (keys of networks that have protocols) */
  function getAvailableNetworkFilters(): string[] {
    return Object.keys(protocolsByNetwork.value);
  }

  /** Check if a network filter is valid */
  function isValidNetworkFilter(filter: string): boolean {
    return getAvailableNetworkFilters().includes(filter.toUpperCase());
  }

  /** Get network filter dropdown options (for UI dropdowns) */
  function getNetworkFilterOptions(): { value: string; label: string; icon: string }[] {
    const filters = getAvailableNetworkFilters();
    return filters.map((filterKey) => {
      const network = networkByKey.value.get(filterKey);
      return {
        value: filterKey,
        label: network?.name ?? filterKey,
        icon: network?.icon ?? ""
      };
    });
  }

  /** Check if a protocol filter (network) is disabled (no active protocols) */
  function isProtocolFilterDisabled(networkFilter: string): boolean {
    const networkProtocols = getActiveProtocolsForNetwork(networkFilter);
    // If no active protocols for this network, it's disabled
    return networkProtocols.length === 0;
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

  /** Get currency by ticker, preferring a protocol that belongs to the given network */
  function getCurrencyByTickerForNetwork(ticker: string, networkFilter: string): CurrencyInfo | undefined {
    const networkProtocols = getActiveProtocolsForNetwork(networkFilter);
    let fallback: CurrencyInfo | undefined;
    for (const currency of Object.values(currenciesData.value)) {
      if (currency.ticker === ticker) {
        if (networkProtocols.includes(currency.protocol)) {
          return currency;
        }
        if (!fallback) {
          fallback = currency;
        }
      }
    }
    return fallback;
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
    const isInitialLoad = !initialized.value;
    if (isInitialLoad) {
      loading.value = true;
    }
    error.value = null;

    try {
      config.value = await BackendApi.getConfig();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch config";
      console.error("[ConfigStore] Failed to fetch config:", e);
      throw e;
    } finally {
      if (isInitialLoad) {
        loading.value = false;
      }
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
   * Fetch gated protocols from /api/protocols/gated
   */
  async function fetchGatedProtocols(): Promise<void> {
    gatedProtocolsLoading.value = true;

    try {
      gatedProtocolsResponse.value = await BackendApi.getGatedProtocols();
    } catch (e) {
      console.error("[ConfigStore] Failed to fetch gated protocols:", e);
      throw e;
    } finally {
      gatedProtocolsLoading.value = false;
    }
  }

  /**
   * Fetch gas fee config from backend
   */
  async function fetchGasFeeConfig(): Promise<void> {
    gasFeeConfig.value = await BackendApi.getGasFeeConfig();
  }

  /**
   * Prefetch currencies for all protocols of a network
   */
  async function prefetchProtocolCurrenciesForNetwork(network: string): Promise<void> {
    const networkProtocols = gatedProtocolsByNetwork.value[network.toUpperCase()] ?? [];
    await Promise.all(networkProtocols.map((p) => getProtocolCurrencies(p.protocol)));
  }

  /**
   * Initialize the store - fetch fresh data from backend
   * Browser HTTP cache (Cache-Control: max-age=3600, stale-while-revalidate=1800)
   * handles caching at the network layer.
   */
  async function initialize(): Promise<void> {
    if (initialized.value) return;

    const networkToFetch = protocolFilter.value || "OSMOSIS";

    await Promise.all([fetchConfig(), fetchCurrencies(), fetchNetworkAssets(networkToFetch), fetchGatedProtocols(), fetchGasFeeConfig()]);
    ensureDefaultProtocolFilter();
    await prefetchProtocolCurrenciesForNetwork(networkToFetch);
    initialized.value = true;
  }

  /** Set protocolFilter to the first available network if it's empty or invalid */
  function ensureDefaultProtocolFilter(): void {
    const available = getAvailableNetworkFilters();
    if (available.length > 0 && !available.includes(protocolFilter.value.toUpperCase())) {
      protocolFilter.value = available[0];
    }
  }

  // Watch for protocol filter changes and refetch assets for the new network
  watch(protocolFilter, async (newFilter) => {
    if (initialized.value && newFilter) {
      await fetchNetworkAssets(newFilter);
      // Also prefetch protocol currencies for the new network
      await prefetchProtocolCurrenciesForNetwork(newFilter).catch((e) => {
        console.error("[ConfigStore] Failed to prefetch protocol currencies:", e);
      });
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
    gatedProtocolsResponse,
    protocolCurrenciesCache,
    gasFeeConfig,
    loading,
    currenciesLoading,
    assetsLoading,
    gatedProtocolsLoading,
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
    assetIcons,
    assetTickersByNetwork,
    hasAssets,

    // Computed - Gated Protocols
    gatedProtocols,
    gatedProtocolsByName,
    gatedProtocolsByNetwork,
    longProtocolsForCurrentNetwork,
    shortProtocolsForCurrentNetwork,
    hasGatedProtocols,

    // Getters - Assets
    getAsset,
    getAssetTickersForNetwork,
    isAssetAvailableForNetwork,

    // Getters - Gated Protocols
    getGatedProtocol,
    getLongProtocolsForNetwork,
    getShortProtocolsForNetwork,
    getProtocolCurrencies,
    getCachedProtocolCurrencies,
    getLeaseCurrenciesForProtocol,
    getCollateralCurrenciesForProtocol,

    // Getters - Protocols & Networks
    getProtocol,
    getNetwork,
    getNetworkByChainId,
    getNetworkByPrefix,
    getNetworkByValue,
    getNetworkNameByProtocol,
    getNetworkFilterByProtocol,
    getNetworkIcon,
    getNetworkIconByProtocol,
    getPositionType,
    isShortPosition,
    isLongPosition,
    getAvailableNetworkFilters,
    isValidNetworkFilter,
    getNetworkFilterOptions,
    isProtocolFilterDisabled,
    getContracts,

    // Getters - Currencies
    getCurrencyByKey,
    getCurrencyByTicker,
    getCurrencyByTickerForNetwork,
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
    fetchGatedProtocols,
    fetchGasFeeConfig,
    prefetchProtocolCurrenciesForNetwork,
    initialize,
    refresh
  };
});
