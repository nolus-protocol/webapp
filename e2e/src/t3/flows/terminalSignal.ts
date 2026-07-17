export interface TerminalSurface {
  toastVisible: boolean;
  errorVisible: boolean;
  errorText: string;
  confirmVisible: boolean;
}

export type TerminalDecision =
  { kind: "success" } | { kind: "error"; text: string } | { kind: "click-confirm" } | { kind: "pending" };

/**
 * Decide the terminal outcome of a form submit from the observed surfaces. The app runs
 * `walletOperation` directly on the footer click — there is NO confirmation dialog — so a success
 * TOAST is the commit signal and the inline error surface is the failure signal. A success toast
 * WINS over a lingering error surface so a committed tx is never journaled as failed. A confirm
 * button is acted on only for forward-compatibility with a future confirm dialog (and the driver
 * scopes it to a dedicated confirm control so it can never re-click a footer submit).
 */
export function decideTerminal(surface: TerminalSurface): TerminalDecision {
  if (surface.toastVisible) {
    return { kind: "success" };
  }
  if (surface.errorVisible) {
    return { kind: "error", text: surface.errorText.trim() || "form error" };
  }
  if (surface.confirmVisible) {
    return { kind: "click-confirm" };
  }
  return { kind: "pending" };
}
