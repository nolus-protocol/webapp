/**
 * WebMCP integration entry point.
 *
 * Feature-detects `navigator.modelContext` (Chrome WebMCP EPP, currently behind
 * a flag). Bails silently on browsers that don't support it — no console noise,
 * no errors, no impact on other users.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 *
 * SCOPE: connect + read + navigate only. No tx-signing tools — see tools.ts.
 */

import type { Router } from "vue-router";
import { buildTools, type WebMcpTool } from "./tools";

interface ModelContextRegisterOptions {
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool(tool: WebMcpTool, options?: ModelContextRegisterOptions): void;
}

declare global {
  interface Navigator {
    readonly modelContext?: ModelContext;
  }
}

let abortController: AbortController | null = null;

export function initWebMcp(router: Router): void {
  if (typeof navigator === "undefined" || !navigator.modelContext) {
    return;
  }

  // Idempotent — drop any prior registration before re-registering (HMR / repeat init).
  disposeWebMcp();

  abortController = new AbortController();
  const signal = abortController.signal;

  for (const tool of buildTools(router)) {
    try {
      navigator.modelContext.registerTool(tool, { signal });
    } catch (e) {
      // A single bad tool shouldn't poison the rest. Log and continue.
      console.warn(`[WebMCP] Failed to register tool "${tool.name}":`, e);
    }
  }
}

export function disposeWebMcp(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeWebMcp());
}
