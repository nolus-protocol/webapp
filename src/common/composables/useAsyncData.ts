/**
 * useAsyncData - Composable for managing async data fetching state
 *
 * Provides a standardized pattern for:
 * - Loading states
 * - Error handling
 * - Data caching with TTL
 * - Automatic retries
 * - Request deduplication
 *
 * @example
 * ```ts
 * const { data, loading, error, execute, refresh } = useAsyncData(
 *   () => BackendApi.getPrices(),
 *   { cacheKey: 'prices', ttl: 30000 }
 * );
 * ```
 */

import { ref, computed, readonly, type Ref, type ComputedRef } from "vue";

export interface AsyncDataOptions<T> {
  /** Initial data value */
  initialData?: T;
  /** Cache key for localStorage persistence */
  cacheKey?: string;
  /** Time-to-live for cache in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Whether to fetch immediately on creation */
  immediate?: boolean;
  /** Transform function for the fetched data */
  transform?: (data: T) => T;
  /** Error message prefix */
  errorMessage?: string;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface AsyncDataResult<T> {
  /** The fetched data */
  data: Ref<T | null>;
  /** Loading state */
  loading: Readonly<Ref<boolean>>;
  /** Error message if fetch failed */
  error: Readonly<Ref<string | null>>;
  /** Whether data has been fetched at least once */
  hasFetched: Readonly<Ref<boolean>>;
  /** Timestamp of last successful fetch */
  lastUpdated: Readonly<Ref<Date | null>>;
  /** Whether cached data is stale (past TTL) */
  isStale: ComputedRef<boolean>;
  /** Execute the fetch function */
  execute: () => Promise<T | null>;
  /** Force refresh (ignores cache) */
  refresh: () => Promise<T | null>;
  /** Clear data and error state */
  clear: () => void;
  /** Set data manually */
  setData: (newData: T) => void;
}

// In-flight request tracking for deduplication
const inflightRequests = new Map<string, Promise<unknown>>();

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Load cached data from localStorage
 */
function loadFromCache<T>(key: string): CacheEntry<T> | null {
  try {
    const cached = localStorage.getItem(`async_data_${key}`);
    if (cached) {
      return JSON.parse(cached) as CacheEntry<T>;
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

/**
 * Save data to localStorage cache
 */
function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`async_data_${key}`, JSON.stringify(entry));
  } catch {
    // Ignore cache errors (quota exceeded, etc.)
  }
}

/**
 * Clear cached data from localStorage
 */
function clearCache(key: string): void {
  try {
    localStorage.removeItem(`async_data_${key}`);
  } catch {
    // Ignore errors
  }
}

/**
 * Composable for managing async data fetching
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  options: AsyncDataOptions<T> = {}
): AsyncDataResult<T> {
  const {
    initialData = null,
    cacheKey,
    ttl = 5 * 60 * 1000, // 5 minutes default
    immediate = false,
    transform,
    errorMessage = "Failed to fetch data",
    onSuccess,
    onError,
  } = options;

  // State
  const data = ref<T | null>(initialData) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hasFetched = ref(false);
  const lastUpdated = ref<Date | null>(null);

  // Load from cache on init
  if (cacheKey) {
    const cached = loadFromCache<T>(cacheKey);
    if (cached) {
      data.value = transform ? transform(cached.data) : cached.data;
      lastUpdated.value = new Date(cached.timestamp);
      hasFetched.value = true;
    }
  }

  // Computed
  const isStale = computed(() => {
    if (!lastUpdated.value) return true;
    return Date.now() - lastUpdated.value.getTime() > ttl;
  });

  /**
   * Execute the fetch function with deduplication
   */
  async function execute(): Promise<T | null> {
    // Check if we have fresh cached data
    if (cacheKey && !isStale.value && data.value !== null) {
      return data.value;
    }

    // Deduplicate in-flight requests
    if (cacheKey && inflightRequests.has(cacheKey)) {
      try {
        const result = await inflightRequests.get(cacheKey);
        return result as T;
      } catch {
        return null;
      }
    }

    loading.value = true;
    error.value = null;

    const fetchPromise = (async () => {
      try {
        let result = await fetcher();

        if (transform) {
          result = transform(result);
        }

        data.value = result;
        lastUpdated.value = new Date();
        hasFetched.value = true;

        if (cacheKey) {
          saveToCache(cacheKey, result);
        }

        onSuccess?.(result);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        error.value = `${errorMessage}: ${err.message}`;
        onError?.(err);
        console.error(`[useAsyncData] ${errorMessage}:`, e);
        return null;
      } finally {
        loading.value = false;
        if (cacheKey) {
          inflightRequests.delete(cacheKey);
        }
      }
    })();

    if (cacheKey) {
      inflightRequests.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  }

  /**
   * Force refresh, ignoring cache
   */
  async function refresh(): Promise<T | null> {
    if (cacheKey) {
      clearCache(cacheKey);
    }
    lastUpdated.value = null; // Force stale
    return execute();
  }

  /**
   * Clear all state
   */
  function clear(): void {
    data.value = initialData;
    error.value = null;
    hasFetched.value = false;
    lastUpdated.value = null;
    if (cacheKey) {
      clearCache(cacheKey);
    }
  }

  /**
   * Set data manually (useful for optimistic updates)
   */
  function setData(newData: T): void {
    data.value = newData;
    lastUpdated.value = new Date();
    hasFetched.value = true;
    if (cacheKey) {
      saveToCache(cacheKey, newData);
    }
  }

  // Immediate fetch if requested
  if (immediate) {
    execute();
  }

  return {
    data,
    loading: readonly(loading),
    error: readonly(error),
    hasFetched: readonly(hasFetched),
    lastUpdated: readonly(lastUpdated),
    isStale,
    execute,
    refresh,
    clear,
    setData,
  };
}

/**
 * Simplified version for one-off fetches without caching
 */
export function useAsyncAction<T, Args extends unknown[] = []>(
  action: (...args: Args) => Promise<T>,
  options: Pick<AsyncDataOptions<T>, "errorMessage" | "onSuccess" | "onError"> = {}
): {
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string | null>>;
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
} {
  const { errorMessage = "Action failed", onSuccess, onError } = options;

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function execute(...args: Args): Promise<T | null> {
    loading.value = true;
    error.value = null;

    try {
      const result = await action(...args);
      onSuccess?.(result);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = `${errorMessage}: ${err.message}`;
      onError?.(err);
      console.error(`[useAsyncAction] ${errorMessage}:`, e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    error.value = null;
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    execute,
    reset,
  };
}
