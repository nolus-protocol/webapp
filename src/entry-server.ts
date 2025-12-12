import { renderToString } from "vue/server-renderer";
import { createApp } from "./main";

export const render = async (url: string, ctx: { theme_data: string; language: string }) => {
  const { app, router } = createApp(ctx);
  await router.push(url);
  await router.isReady();

  const html = await renderToString(app, ctx);

  return {
    html
  };
};
