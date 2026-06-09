import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import prettierConfig from "eslint-config-prettier";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  {
    ignores: ["dist/", "public/", "node_modules/", "backend/"]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  prettierConfig,

  {
    files: ["src/**/*.{ts,vue}"],
    languageOptions: {
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLImageElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        NodeJS: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        WebSocket: "readonly",
        CloseEvent: "readonly",
        MessageEvent: "readonly",
        Notification: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        Uint8Array: "readonly",
        Buffer: "readonly",
        btoa: "readonly",
        atob: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        performance: "readonly",
        indexedDB: "readonly",
        IDBDatabase: "readonly",
        ServiceWorkerRegistration: "readonly",
        PushSubscription: "readonly",
        Response: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Map: "readonly",
        Set: "readonly",
        Promise: "readonly",
        Proxy: "readonly",
        Symbol: "readonly",
        WeakMap: "readonly",
        BigInt: "readonly",
        CanvasRenderingContext2D: "readonly",
        Image: "readonly"
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        sourceType: "module",
        projectService: true,
        tsconfigRootDir
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "prefer-const": "error",
      "no-constant-condition": "error",
      "no-dupe-keys": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "no-fallthrough": "error",

      eqeqeq: ["error", "always", { null: "ignore" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "separate-type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksConditionals: true, checksVoidReturn: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],

      "vue/multi-word-component-names": "off"
    }
  },

  {
    files: ["src/common/utils/Logger.ts"],
    rules: {
      "no-console": "off"
    }
  },

  {
    files: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
