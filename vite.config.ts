import { fileURLToPath, URL } from "node:url";
import { resolve, dirname } from "node:path";
import { defineConfig, splitVendorChunkPlugin } from "vite";

import vue from "@vitejs/plugin-vue";
import vueI18n from "@intlify/unplugin-vue-i18n/vite";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

import rollupNodePolyFill from "rollup-plugin-polyfill-node";

enum COMMANDS {
  "SERVE" = "serve",
  "BUILD" = "build",
}

export default defineConfig((command, mode, ssrBuild) => {
  const polyfills = [];
  const plugins = [];

  if (COMMANDS.BUILD == command.command) {
    polyfills.push(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "./modules/Buffer.js"
      )
    );

    polyfills.push(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "./modules/process.js"
      )
    );

    plugins.push(NodeModulesPolyfillPlugin());
  }

  const config = {
    plugins: [
      vue(),
      vueI18n({
        compositionOnly: true,
        include: resolve(
          dirname(fileURLToPath(import.meta.url)),
          "./src/locales/**"
        ),
      }),
      splitVendorChunkPlugin(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "buffer/": "rollup-plugin-node-polyfills/polyfills/buffer-es6",
        "string_decoder/": "rollup-plugin-node-polyfills/polyfills/string-decoder",
        util: "rollup-plugin-node-polyfills/polyfills/util",
        sys: "util",
        events: "rollup-plugin-node-polyfills/polyfills/events",
        stream: "rollup-plugin-node-polyfills/polyfills/stream",
        path: "rollup-plugin-node-polyfills/polyfills/path",
        querystring: "rollup-plugin-node-polyfills/polyfills/qs",
        punycode: "rollup-plugin-node-polyfills/polyfills/punycode",
        url: "rollup-plugin-node-polyfills/polyfills/url",
        string_decoder: "rollup-plugin-node-polyfills/polyfills/string-decoder",
        http: "rollup-plugin-node-polyfills/polyfills/http",
        https: "rollup-plugin-node-polyfills/polyfills/http",
        os: "rollup-plugin-node-polyfills/polyfills/os",
        assert: "rollup-plugin-node-polyfills/polyfills/assert",
        constants: "rollup-plugin-node-polyfills/polyfills/constants",
        _stream_duplex: "rollup-plugin-node-polyfills/polyfills/readable-stream/duplex",
        _stream_passthrough: "rollup-plugin-node-polyfills/polyfills/readable-stream/passthrough",
        _stream_readable: "rollup-plugin-node-polyfills/polyfills/readable-stream/readable",
        _stream_writable: "rollup-plugin-node-polyfills/polyfills/readable-stream/writable",
        _stream_transform: "rollup-plugin-node-polyfills/polyfills/readable-stream/transform",
        timers: "rollup-plugin-node-polyfills/polyfills/timers",
        console: "rollup-plugin-node-polyfills/polyfills/console",
        vm: "rollup-plugin-node-polyfills/polyfills/vm",
        zlib: "rollup-plugin-node-polyfills/polyfills/zlib",
        tty: "rollup-plugin-node-polyfills/polyfills/tty",
        domain: "rollup-plugin-node-polyfills/polyfills/domain",
        buffer: "rollup-plugin-node-polyfills/polyfills/buffer-es6",
        process: "rollup-plugin-node-polyfills/polyfills/process-es6",
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        inject: [...polyfills],
        define: {
          global: "globalThis",
        },
        plugins: [...plugins],
      },
    },
    build: {
      rollupOptions: {
        plugins: [rollupNodePolyFill()],
        external: ["@solana/web3.js"],
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
              "@cosmjs/tendermint-rpc",
            ],
            "@keplr-wallet": [
              "@keplr-wallet/crypto",
              "@keplr-wallet/types",
              "@keplr-wallet/unit",
            ],
            "@ledgerhq": [
              "@ledgerhq/hw-app-cosmos",
              "@ledgerhq/hw-transport-web-ble",
              "@ledgerhq/hw-transport-webhid",
              "@ledgerhq/hw-transport-webusb",
              "@ledgerhq/logs",
            ],
            "@web3auth": [
              "@web3auth/base",
              "@web3auth/openlogin-adapter",
              "@web3auth/core",
            ],
            dashboard: [
              "./src/views/LeaseView.vue",
              "./src/views/EarningsView.vue",
              "./src/views/HistoryView.vue",
            ],
            auth: [
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
  };
  return config;

});
