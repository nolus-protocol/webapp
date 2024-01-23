import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

import vue from '@vitejs/plugin-vue'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import rollupNodePolyFill from 'rollup-plugin-polyfill-node'

export default defineConfig({
  plugins: [
    vue(),
    vueI18n({
      compositionOnly: true,
      strictMessage: false,
      runtimeOnly: false
    })
  ],
  server: {
    hmr: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  optimizeDeps: {
    exclude: ['@solana/web3.js', 'marked'],
    esbuildOptions: {
      sourcemap: false,
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        })
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: [rollupNodePolyFill()],
      external: ['@solana/web3.js', 'marked'],
      output: {
        manualChunks: {
          '@web3auth': ['@web3auth/base', '@web3auth/openlogin-adapter', '@web3auth/no-modal'],
          dashboard: [
            './src/views/LeaseView.vue',
            './src/views/EarningsView.vue',
            './src/views/HistoryView.vue'
          ],
          auth: [
            './src/views/AuthView.vue',
            './src/views/AuthSelectView.vue',
            './src/views/ImportSeedView.vue',
            './src/views/CreateAccountView.vue',
            './src/views/SetPassword.vue',
            './src/views/SetWalletName.vue',
            './src/views/ConnectingKeplr.vue',
            './src/views/ImportLedgerView.vue',
            './src/views/GoogleAuthView.vue'
          ]
        }
      }
    }
  }
})
