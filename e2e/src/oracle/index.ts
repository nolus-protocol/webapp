/**
 * The independent render oracle. It recomputes what the app should display from the API
 * payloads the app consumed, importing NOTHING from the app's `src/` — the point of the
 * math bridge is to recompute independently, not to test a formatter against itself.
 */

export { Decimal } from "./decimal.js";
export * from "./format.js";
export * from "./animated.js";
export * from "./lease.js";
