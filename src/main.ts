import "@/index.css";
import "@/assets/styles/global.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { setupI18n } from "./i18n";

import App from "@/App.vue";
import router from "@/router";

const app = createApp(App);
app.use(setupI18n());
app.use(createPinia());
app.use(router);

app.mount("#app");
