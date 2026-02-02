/**
 * LanguageUtils - Language and localization settings
 *
 * Handles language preferences stored in localStorage, cookies, and IndexedDB.
 */

import { languages } from "@/config/global";
import { idbPut } from "@/push/database";
import { setCookie } from "./cookieUtils";

export const LANGUAGE_KEY = "language";

/**
 * Set the application language
 */
export function setLanguage(lang: string): void {
  localStorage.setItem(LANGUAGE_KEY, lang);
  setCookie(LANGUAGE_KEY, lang);
  setLanguageDb(lang);
}

/**
 * Get the current language configuration
 */
export function getLanguage(): (typeof languages)[keyof typeof languages] {
  const storedLang = localStorage.getItem(LANGUAGE_KEY);
  const availableLanguages = Object.keys(languages);

  if (storedLang && availableLanguages.includes(storedLang)) {
    return languages[storedLang as keyof typeof languages];
  }

  return languages.en;
}

/**
 * Get the current language code
 */
export function getLanguageCode(): string {
  return localStorage.getItem(LANGUAGE_KEY) || "en";
}

/**
 * Store language preference in IndexedDB (for service worker/push notifications)
 */
export function setLanguageDb(lang: string): void {
  idbPut(LANGUAGE_KEY, lang);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(lang: string): boolean {
  return Object.keys(languages).includes(lang);
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(languages);
}


