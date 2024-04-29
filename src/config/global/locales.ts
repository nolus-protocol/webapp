import { isDev } from "./modes";

let languages: {
  [key: string]: {
    key: string;
    label: string;
    url: string | Promise<string>;
  };
} = {
  en: {
    key: "en",
    label: "English",
    url: import("../../locales/en.json?url").then((t) => t.default)
  },
  ru: {
    key: "ru",
    label: "Русский",
    url: import("../../locales/ru.json?url").then((t) => t.default)
  },
  cn: {
    key: "cn",
    label: "中文",
    url: import("../../locales/cn.json?url").then((t) => t.default)
  },
  fr: {
    key: "fr",
    label: "Français",
    url: import("../../locales/fr.json?url").then((t) => t.default)
  },
  es: {
    key: "es",
    label: "Español",
    url: import("../../locales/es.json?url").then((t) => t.default)
  },
  gr: {
    key: "gr",
    label: "Ελληνικά",
    url: import("../../locales/gr.json?url").then((t) => t.default)
  },
  tr: {
    key: "tr",
    label: "Türkçe",
    url: import("../../locales/tr.json?url").then((t) => t.default)
  },
  id: {
    key: "id",
    label: "Bahasa Indo",
    url: import("../../locales/id.json?url").then((t) => t.default)
  },
  jp: {
    key: "jp",
    label: "日本語",
    url: import("../../locales/jp.json?url").then((t) => t.default)
  }
};

if (!isDev()) {
  languages = {
    en: {
      key: "en",
      label: "English",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/en.json"
    },
    ru: {
      key: "ru",
      label: "Русский",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/ru.json"
    },
    cn: {
      key: "cn",
      label: "中文",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/cn.json"
    },
    fr: {
      key: "fr",
      label: "Français",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/fr.json"
    },
    es: {
      key: "es",
      label: "Español",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/es.json"
    },
    gr: {
      key: "gr",
      label: "Ελληνικά",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/gr.json"
    },
    tr: {
      key: "tr",
      label: "Türkçe",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/tr.json"
    },
    id: {
      key: "id",
      label: "Bahasa Indo",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/id.json"
    },
    jp: {
      key: "jp",
      label: "日本語",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/jp.json"
    }
  };
}

export { languages };
