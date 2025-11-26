import { isDev } from "./modes";

let languages: {
  [key: string]: {
    key: string;
    label: string;
    load: () => Promise<Record<string, any>>;
  };
} = {
  en: {
    key: "en",
    label: "English",
    load: () => import("../../locales/en.json").then((t) => t.default)
  },
  ru: {
    key: "ru",
    label: "Русский",
    load: () => import("../../locales/ru.json").then((t) => t.default)
  },
  cn: {
    key: "cn",
    label: "中文",
    load: () => import("../../locales/cn.json").then((t) => t.default)
  },
  fr: {
    key: "fr",
    label: "Français",
    load: () => import("../../locales/fr.json").then((t) => t.default)
  },
  es: {
    key: "es",
    label: "Español",
    load: () => import("../../locales/es.json").then((t) => t.default)
  },
  gr: {
    key: "gr",
    label: "Ελληνικά",
    load: () => import("../../locales/gr.json").then((t) => t.default)
  },
  tr: {
    key: "tr",
    label: "Türkçe",
    load: () => import("../../locales/tr.json").then((t) => t.default)
  },
  id: {
    key: "id",
    label: "Bahasa Indo",
    load: () => import("../../locales/id.json").then((t) => t.default)
  },
  jp: {
    key: "jp",
    label: "日本語",
    load: () => import("../../locales/jp.json").then((t) => t.default)
  },
  kr: {
    key: "kr",
    label: "한국어",
    load: () => import("../../locales/kr.json").then((t) => t.default)
  }
};

if (!isDev()) {
  languages = {
    en: {
      key: "en",
      label: "English",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/en.json").then((d) => d.json())
    },
    ru: {
      key: "ru",
      label: "Русский",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/ru.json").then((d) => d.json())
    },
    cn: {
      key: "cn",
      label: "中文",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/cn.json").then((d) => d.json())
    },
    fr: {
      key: "fr",
      label: "Français",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/fr.json").then((d) => d.json())
    },
    es: {
      key: "es",
      label: "Español",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/es.json").then((d) => d.json())
    },
    gr: {
      key: "gr",
      label: "Ελληνικά",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/gr.json").then((d) => d.json())
    },
    tr: {
      key: "tr",
      label: "Türkçe",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/tr.json").then((d) => d.json())
    },
    id: {
      key: "id",
      label: "Bahasa Indo",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/id.json").then((d) => d.json())
    },
    jp: {
      key: "jp",
      label: "日本語",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/jp.json").then((d) => d.json())
    },
    kr: {
      key: "kr",
      label: "한국어",
      load: () =>
        fetch("https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/kr.json").then((d) => d.json())
    }
  };
}

export { languages };
