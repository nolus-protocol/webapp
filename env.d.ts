/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

interface ImportMetaEnv {
  readonly VITE_APP_NETWORKS: string;
  readonly VITE_MODE: string;
  readonly VITE_DEFAULT_NETWORK: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
