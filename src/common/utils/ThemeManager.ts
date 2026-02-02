/**
 * ThemeManager - Simple theme management utility
 *
 * Handles theme persistence to localStorage and applying theme to DOM.
 * No reactive state needed - just localStorage and DOM manipulation.
 */

import { APPEARANCE } from "@/config/global";
import { setCookie } from "./cookieUtils";

export type Theme = "light" | "dark" | "sync";

const THEME_STORAGE_KEY = "theme_data";

/**
 * Get the current theme from localStorage
 */
export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && isValidTheme(stored)) {
    return stored as Theme;
  }
  return "sync";
}

/**
 * Set and persist the theme
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  setCookie(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply theme to DOM
 */
export function applyTheme(theme: Theme): void {
  const resolvedTheme = resolveTheme(theme);
  
  if (resolvedTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/**
 * Resolve "sync" theme to actual light/dark based on system preference
 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "sync") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/**
 * Initialize theme on app startup
 */
export function initTheme(): void {
  const theme = getTheme();
  applyTheme(theme);

  // Listen for system theme changes when using "sync" mode
  if (theme === "sync") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      const currentTheme = getTheme();
      if (currentTheme === "sync") {
        applyTheme("sync");
      }
    });
  }
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): void {
  const current = getTheme();
  const resolved = resolveTheme(current);
  setTheme(resolved === "dark" ? "light" : "dark");
}

/**
 * Check if a string is a valid theme value
 */
function isValidTheme(value: string): value is Theme {
  return value === "light" || value === "dark" || value === "sync";
}

/**
 * Legacy class interface for backwards compatibility
 * @deprecated Use the standalone functions instead
 */
export class ThemeManager {
  public static THEME_DATA = THEME_STORAGE_KEY;

  public static saveThemeData(theme: string): void {
    if (isValidTheme(theme)) {
      setTheme(theme);
    }
  }

  public static getThemeData(): string {
    const theme = getTheme();
    return APPEARANCE[theme] || APPEARANCE.sync;
  }
}
