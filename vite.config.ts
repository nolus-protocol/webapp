import { fileURLToPath, URL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { defineConfig, splitVendorChunkPlugin } from 'vite';

import vue from '@vitejs/plugin-vue';
import vueI18n from '@intlify/vite-plugin-vue-i18n';
import inject from '@rollup/plugin-inject';

export default defineConfig({
  define: {
    'process.env': {}
  },
  plugins: [
    vue(),
    vueI18n({
      compositionOnly: true,
      include: resolve(
        dirname(fileURLToPath(import.meta.url)),
        './src/locales/**'
      ),
    }),
    splitVendorChunkPlugin()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      process: 'process/browser',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      util: 'util/'
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        inject({ Buffer: ['buffer', 'Buffer'], process: ['process', 'process'] }),
      ],
      output: {
        manualChunks: {
          '@cosmjs': [
            '@cosmjs/amino',
            '@cosmjs/cosmwasm-stargate',
            '@cosmjs/crypto',
            '@cosmjs/encoding',
            '@cosmjs/ledger-amino',
            '@cosmjs/proto-signing',
            '@cosmjs/stargate',
            '@cosmjs/tendermint-rpc'
          ],
          '@keplr-wallet': [
            '@keplr-wallet/crypto',
            '@keplr-wallet/types',
            '@keplr-wallet/unit'
          ],
          '@ledgerhq': [
            '@ledgerhq/hw-app-cosmos',
            '@ledgerhq/hw-transport-web-ble',
            '@ledgerhq/hw-transport-webhid',
            '@ledgerhq/hw-transport-webusb',
            '@ledgerhq/logs'
          ],
          '@web3auth': [
            '@web3auth/base',
            '@web3auth/openlogin-adapter',
            '@web3auth/modal'
          ]
        },
      },
    },
  },
});
