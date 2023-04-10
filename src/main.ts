import "@/index.css";
import "@/assets/styles/global.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";

import App from "@/App.vue";
import router from "@/router";
import en from "@/locales/en";

export const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en }
});

const app = createApp(App);
app.use(i18n);
app.use(createPinia());
app.use(router);

app.mount("#app");
