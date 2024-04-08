import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [resolve(__dirname, "./src/locales/**")],
      compositionOnly: true,
      strictMessage: false,
      runtimeOnly: false
    }),
    nodePolyfills({
      include: ["path", "stream", "util"],
      exclude: ["http"],
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      overrides: {
        fs: "memfs"
      },
      protocolImports: true
    })
  ],
  server: {
    host: true,
    port: 8081
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  optimizeDeps: {
    exclude: [],
    esbuildOptions: {
      sourcemap: false,
      define: {
        global: "globalThis"
      }
    }
  }
});
