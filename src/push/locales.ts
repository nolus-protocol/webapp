import type { IObjectKeys } from "@/common/types";
import { templateParser } from "./helpers";

let languages: {
  [key: string]: {
    url: string;
  };
} = {
  en: {
    url: "http://localhost:8080/locales/en.json"
  },
  ru: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/ru.json"
  },
  cn: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/cn.json"
  },
  fr: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/fr.json"
  },
  es: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/es.json"
  },
  gr: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/gr.json"
  },
  tr: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/tr.json"
  },
  id: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/id.json"
  },
  jp: {
    url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/jp.json"
  }
};

const loaded: { [key: string]: Promise<{ [key: string]: string }> } = {};

async function translate(lang: string, expression: string, valueObj: IObjectKeys) {
  const l = await loadLocaleMessages(lang);
  return templateParser(l[expression], valueObj);
}

export async function loadLocaleMessages(locale: string) {
  if (!loaded[locale]) {
    const lang = languages[locale as keyof typeof languages];
    const data = await fetch(lang.url);
    const messages = await data.json();
    loaded[locale] = messages.push;
  }
  return loaded[locale];
}

export { translate };
