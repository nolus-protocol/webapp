import { createI18n } from "vue-i18n";
import { nextTick } from 'vue'
import { languages } from "./config/env";

const options = { locale: 'en', fallbackLocale: "en" };

export const i18n = createI18n(options)

export function setupI18n() {
    setI18nLanguage(options.locale)
    return i18n
}

export function setI18nLanguage(locale: string) {
    if (i18n.mode === 'legacy') {
        i18n.global.locale = locale
    } else {
        (i18n.global.locale as any).value = locale
    }
    document.querySelector('html')?.setAttribute('lang', locale)
}

export async function loadLocaleMessages(locale: string) {
    const lang = languages[locale as keyof typeof languages] ?? languages.en;
    const url = await getUrl(lang);
    const data = await fetch(url);
    const messages = await data.json();
    i18n.global.setLocaleMessage(locale, messages)
    return nextTick()
}

export async function getUrl(lang: {
    key: string;
    label: string;
    url: string | Promise<string>;
}) {
    switch (lang.url.constructor) {
        case (Promise): {
            return lang.url
        }
        default: {
            return lang.url;
        }
    }
}

export async function setLang(lang: string = languages.en.key) {
    await loadLocaleMessages(lang);
    setI18nLanguage(lang);
}