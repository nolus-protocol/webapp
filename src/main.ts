import "@/index.css";
import "@/assets/styles/global.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "@/App.vue";
import router from "@/router";
import { i18n } from "./i18n";

const app = createApp(App);
app.use(router);
app.use(i18n);
app.use(createPinia());

app.mount("#app");
