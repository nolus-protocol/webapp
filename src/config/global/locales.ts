// Load locale files directly from backend config (single source of truth)
// Uses dynamic imports for code-splitting - only loads locale when needed
// Path is relative to project root for import.meta.glob
const localeModules = import.meta.glob("/backend/config/locales/active/*.json");

// Helper to load a locale, returns empty object if not found
const loadLocale = (lang: string) => async (): Promise<Record<string, unknown>> => {
  const path = `/backend/config/locales/active/${lang}.json`;
  const loader = localeModules[path];
  if (loader) {
    const module = (await loader()) as { default: Record<string, unknown> };
    return module.default;
  }
  // Locale not found - return empty, will fall back to default locale
  return {};
};

const languages: {
  [key: string]: {
    key: string;
    label: string;
    load: () => Promise<Record<string, unknown>>;
  };
} = {
  en: { key: "en", label: "English", load: loadLocale("en") },
  ru: { key: "ru", label: "Русский", load: loadLocale("ru") },
  cn: { key: "cn", label: "中文", load: loadLocale("cn") },
  fr: { key: "fr", label: "Français", load: loadLocale("fr") },
  es: { key: "es", label: "Español", load: loadLocale("es") },
  gr: { key: "gr", label: "Ελληνικά", load: loadLocale("gr") },
  tr: { key: "tr", label: "Türkçe", load: loadLocale("tr") },
  id: { key: "id", label: "Bahasa Indo", load: loadLocale("id") },
  jp: { key: "jp", label: "日本語", load: loadLocale("jp") },
  kr: { key: "kr", label: "한국어", load: loadLocale("kr") }
};

export { languages };
