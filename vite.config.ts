import { fileURLToPath, URL } from "node:url";
import { resolve, dirname } from "node:path";
import { defineConfig, splitVendorChunkPlugin } from "vite";

import vue from "@vitejs/plugin-vue";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import NodeGlobalsPolyfillPlugin from "@esbuild-plugins/node-globals-polyfill";
import rollupNodePolyFill from "rollup-plugin-polyfill-node"

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({
      compositionOnly: true,
      include: resolve(
        dirname(fileURLToPath(import.meta.url)),
        "./src/locales/**"
      ),
    }),
    splitVendorChunkPlugin()
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
      define: {
        global: "globalThis"
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }),
      ],
    }
  },
  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyFill(),
      ],
      output: {
        manualChunks: {
          "@cosmjs": [
            "@cosmjs/amino",
            "@cosmjs/cosmwasm-stargate",
            "@cosmjs/crypto",
            "@cosmjs/encoding",
            "@cosmjs/ledger-amino",
            "@cosmjs/proto-signing",
            "@cosmjs/stargate",
            "@cosmjs/tendermint-rpc"
          ],
          "@keplr-wallet": [
            "@keplr-wallet/crypto",
            "@keplr-wallet/types",
            "@keplr-wallet/unit"
          ],
          "@ledgerhq": [
            "@ledgerhq/hw-app-cosmos",
            "@ledgerhq/hw-transport-web-ble",
            "@ledgerhq/hw-transport-webhid",
            "@ledgerhq/hw-transport-webusb",
            "@ledgerhq/logs"
          ],
          "@web3auth": [
            "@web3auth/base",
            "@web3auth/openlogin-adapter",
            "@web3auth/core"
          ],
          "dashboard": [
            "./src/views/LeaseView.vue",
            "./src/views/EarningsView.vue",
            "./src/views/HistoryView.vue"
          ],
          "auth": [
            "./src/views/AuthView.vue",
            "./src/views/AuthSelectView.vue",
            "./src/views/ImportSeedView.vue",
            "./src/views/CreateAccountView.vue",
            "./src/views/SetPassword.vue",
            "./src/views/SetWalletName.vue",
            "./src/views/ConnectingKeplr.vue",
            "./src/views/ImportLedgerView.vue",
            "./src/views/GoogleAuthView.vue",
          ],
        },
      },
    },
  },
});
