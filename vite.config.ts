import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { cp } from "fs/promises";
import { nodePolyfills } from "vite-plugin-node-polyfills";

import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";

const downpayments_range_dir = fileURLToPath(new URL("./src/config/lease/downpayment-range", import.meta.url));
const public_dir = "public";

const downpayments_range = () => ({
  name: "downpayments-range-copy",
  configResolved,
  handleHotUpdate: async ({ file, server }: { file: string; server: any }) => {
    if (file.includes(downpayments_range_dir)) {
      await configResolved();
      server.ws.send({
        type: "full-reload",
        path: "*"
      });
    }
  }
});

async function configResolved() {
  const public_locales_dir = fileURLToPath(new URL(`./${public_dir}/downpayment-range`, import.meta.url));
  await cp(downpayments_range_dir, public_locales_dir, { recursive: true });
}

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
    downpayments_range(),
    nodePolyfills({
      include: ["path", "stream", "util", "crypto"],
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
  build: {
    rollupOptions: {
      output: {
        sourcemapExcludeSources: true,
        manualChunks: (id) => {
          const url = new URL(id, import.meta.url);
          const chunkName = url.searchParams.get("chunkName");
          if (chunkName) {
            return chunkName;
          }
        }
      }
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
