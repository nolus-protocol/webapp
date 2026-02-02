/**
 * BannerUtils - Banner visibility management
 *
 * Handles dismissible banner states stored in localStorage.
 */

const BANNER_PREFIX = "banner";

/**
 * Mark a banner as dismissed/invisible
 */
export function dismissBanner(key: string): void {
  localStorage.setItem(`${BANNER_PREFIX}-${key}`, "1");
}

/**
 * Check if a banner should be shown
 * Returns true if the banner has NOT been dismissed
 */
export function isBannerVisible(key: string): boolean {
  return !Number(localStorage.getItem(`${BANNER_PREFIX}-${key}`));
}

/**
 * Reset a banner to be visible again
 */
export function resetBanner(key: string): void {
  localStorage.removeItem(`${BANNER_PREFIX}-${key}`);
}

/**
 * Reset all banners
 */
export function resetAllBanners(): void {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(`${BANNER_PREFIX}-`)) {
      localStorage.removeItem(key);
    }
  }
}


