import { router } from "@/router";
import { setupI18n } from "@/i18n";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { Mode } from "./config/global";

import App from "@/App.vue";

import "@/index.scss";
import "@/assets/styles/global.scss";

if (import.meta.env.VITE_MODE == Mode.prod) {
  console.log = () => null;
}

const app = createApp(App);
app.use(setupI18n());
app.use(createPinia());
app.use(router);

app.mount("#app");
