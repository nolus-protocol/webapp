import { createI18n } from "vue-i18n";
import { nextTick } from "vue";
import { languages } from "./config/global";

const options = { locale: "en", fallbackLocale: "en", legacy: false, globalInjection: true };

export const i18n = createI18n(options);

export function setupI18n() {
  setI18nLanguage(options.locale);
  return i18n;
}

export function setI18nLanguage(locale: string) {
  (i18n.global.locale as any).value = locale;
  if (!import.meta.env.SSR) {
    document.querySelector("html")?.setAttribute("lang", locale);
  }
}

export async function loadLocaleMessages(locale: string) {
  const lang = languages[locale as keyof typeof languages] ?? languages.en;
  const data = await lang.load();
  i18n.global.setLocaleMessage(locale, data);
  return nextTick();
}

export async function setLang(lang: string = languages.en.key) {
  await loadLocaleMessages(lang);
  setI18nLanguage(lang);
}
