
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import vue from '@vitejs/plugin-vue';
import vueI18n from '@intlify/unplugin-vue-i18n/vite';
import NodeGlobalsPolyfillPlugin from "@esbuild-plugins/node-globals-polyfill";
import rollupNodePolyFill from 'rollup-plugin-polyfill-node';

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({
      compositionOnly: true,
      strictMessage: false,
      runtimeOnly: false
    }),
    VitePWA({
      injectRegister: false,
      manifest: {
        "name": "Nolus Protocol",
        "short_name": "Nolus",
        "description": "Maximize your assets without amplifying risk – unleash the full potential of your leveraged holdings",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#EBEFF5",
        "theme_color": "#082D63",
        "lang": "en-US",
        "categories": ["finance"],
        "icons": [
          {
            "src": "https://nolus.io/other/pwa_nolus_logo_element.svg",
            "type": "image/svg+xml"
          },
          {
            "src": "https://nolus.io/other/pwa_nolus_logo_element.svg",
            "type": "image/svg+xml"
          }
        ]
      },
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    exclude: ["@solana/web3.js"],
    esbuildOptions: {
      sourcemap: false,
      define: {
        global: 'globalThis'
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
      external: ["@solana/web3.js"],
      output: {
        manualChunks: {
          '@web3auth': [
            '@web3auth/base',
            '@web3auth/openlogin-adapter',
            '@web3auth/no-modal'
          ],
          'dashboard': [
            './src/views/LeaseView.vue',
            './src/views/EarningsView.vue',
            './src/views/HistoryView.vue'
          ],
          'auth': [
            './src/views/AuthView.vue',
            './src/views/AuthSelectView.vue',
            './src/views/ImportSeedView.vue',
            './src/views/CreateAccountView.vue',
            './src/views/SetPassword.vue',
            './src/views/SetWalletName.vue',
            './src/views/ConnectingKeplr.vue',
            './src/views/ImportLedgerView.vue',
            './src/views/GoogleAuthView.vue',
          ],
        },
      },
    },
  },
});