import { BackendApi } from "@/common/api";

// Load locale from backend API
const loadLocale = (lang: string) => () =>
  BackendApi.getWebappLocale(lang) as Promise<Record<string, unknown>>;

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
  kr: { key: "kr", label: "한국어", load: loadLocale("kr") },
};

export { languages };
