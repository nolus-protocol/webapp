import type { IObjectKeys } from "@/common/types";
import { templateParser } from "./helpers";

// Supported languages for push notifications
const supportedLanguages = ["en", "ru", "cn", "fr", "es", "gr", "tr", "id", "jp", "kr"];

// Backend URL for locale fetching (same as main app)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("VITE_BACKEND_URL environment variable is required");
}

const loaded: { [key: string]: Promise<{ [key: string]: string }> } = {};

async function translate(lang: string, expression: string, valueObj: IObjectKeys) {
  const l = await loadLocaleMessages(lang);
  return templateParser(l[expression], valueObj);
}

export async function loadLocaleMessages(locale: string) {
  if (!loaded[locale]) {
    // Validate locale
    const lang = supportedLanguages.includes(locale) ? locale : "en";
    
    // Fetch from backend API instead of GitHub
    const data = await fetch(`${BACKEND_URL}/api/webapp/locales/${lang}`);
    const messages = await data.json();
    loaded[locale] = messages.push;
  }
  return loaded[locale];
}

export { translate };
