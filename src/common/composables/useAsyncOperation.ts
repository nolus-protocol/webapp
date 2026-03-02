/**
 * useAsyncOperation - Simple async operation wrapper for components
 */

import { ref } from "vue";
import { ApiError } from "@/common/api/types/common";

export interface ErrorDetails {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Handles the common pattern of:
 * - Setting loading = true before operation
 * - Setting loading = false after operation
 * - Catching errors and preserving error context
 *
 * @example
 * ```ts
 * const { loading, error, errorDetails, run } = useAsyncOperation();
 *
 * async function submit() {
 *   await run(async () => {
 *     await api.saveData();
 *   });
 *   if (errorDetails.value?.status === 429) {
 *     // handle rate limit
 *   }
 * }
 * ```
 */
export function useAsyncOperation() {
  const loading = ref(false);
  const error = ref("");
  const errorDetails = ref<ErrorDetails | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true;
    error.value = "";
    errorDetails.value = null;
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err.message;
      if (e instanceof ApiError) {
        errorDetails.value = { message: err.message, status: e.status, code: e.code };
      } else {
        errorDetails.value = { message: err.message };
      }
      console.error("[useAsyncOperation]", e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, errorDetails, run };
}
