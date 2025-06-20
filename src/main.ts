import { createPinia } from "pinia";
import { setupI18n } from "@/i18n";
import { router } from "@/router";
import { createApp } from "vue";
import { Mode } from "./config/global";
import App from "@/App.vue";

import "@/index.scss";
import "@/assets/styles/global.scss";

if (import.meta.env.VITE_MODE == Mode.prod) {
  console.log = () => null;
}

const app = createApp(App);

app.use(router);
app.use(createPinia());
app.use(setupI18n());

app.mount("#app");
