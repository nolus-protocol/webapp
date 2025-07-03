import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { cp } from "fs/promises";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import svgLoader from "vite-svg-loader";

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
    svgLoader(),
    VueI18nPlugin({
      include: [resolve(__dirname, "./src/locales/**")],
      compositionOnly: true,
      strictMessage: false,
      runtimeOnly: false
    }),
    downpayments_range(),
    nodePolyfills({
      include: ["stream", "util", "crypto", "http", "https", "vm", "zlib"],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  server: {
    host: "127.0.0.1",
    allowedHosts: []
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
  },
  build: {
    minify: "terser",
    chunkSizeWarningLimit: 750,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      format: {
        comments: false
      }
    }
  }
});
