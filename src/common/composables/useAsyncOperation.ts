/**
 * useAsyncOperation - Simple async operation wrapper for components
 */

import { ref } from "vue";

/**
 * Handles the common pattern of:
 * - Setting loading = true before operation
 * - Setting loading = false after operation
 * - Catching errors and logging them
 *
 * @example
 * ```ts
 * const { loading, error, run } = useAsyncOperation();
 *
 * async function submit() {
 *   await run(async () => {
 *     await api.saveData();
 *   });
 * }
 * ```
 */
export function useAsyncOperation() {
  const loading = ref(false);
  const error = ref("");

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true;
    error.value = "";
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err.message;
      console.error("[useAsyncOperation]", e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, run };
}
