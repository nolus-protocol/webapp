import type { InlineConfig, HmrContext, ViteDevServer, Plugin as VitePlugin } from "vite";
import type { NormalizedOutputOptions, OutputBundle, PluginContext } from "rollup";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { build, defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import svgLoader from "vite-svg-loader";
import inject from "@rollup/plugin-inject";
import crypto from "node:crypto";

const public_dir = "public";
const worker = resolve(__dirname, "src/push/worker.ts");

const injections = inject({
  Buffer: ["buffer", "Buffer"] // whenever code uses Buffer, import it from 'buffer'
});

type WorkerContext = ViteDevServer | { config?: { mode?: string } } | undefined;

async function bundleWorker(ctx?: WorkerContext): Promise<void> {
  const isServe = !!ctx && "config" in ctx && ctx.config?.mode === "serve";

  const config: InlineConfig = {
    configFile: false,
    root: process.cwd(),
    build: {
      minify: "terser",
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true },
        format: { comments: false }
      },
      chunkSizeWarningLimit: 750,
      lib: {
        entry: worker,
        name: "worker",
        fileName: "worker"
      },
      outDir: resolve(__dirname, "dist"),
      emptyOutDir: false,
      rollupOptions: {
        plugins: [injections]
      }
    }
  };

  if (isServe && config.build) {
    config.build.minify = false;
    config.build.outDir = resolve(__dirname, public_dir);
  }

  await build(config);
}

const buildWorkerPlugin = (): VitePlugin => ({
  name: "build-workercopy",
  closeBundle() {
    return bundleWorker();
  },
  configureServer(server: ViteDevServer) {
    return bundleWorker(server);
  },

  async handleHotUpdate(ctx: HmrContext) {
    if (!ctx.file.includes(worker)) return;

    await bundleWorker(ctx.server);
    ctx.server.ws.send({
      type: "full-reload",
      path: "*"
    });
  }
});

const deinlineFontDataUrls = (): VitePlugin => {
  return {
    name: "deinline-font-data-urls",
    apply: "build",

    generateBundle(this: PluginContext, _options: NormalizedOutputOptions, bundle: OutputBundle) {
      const dataUrlRegex = /url\((["']?)data:(font\/[a-z0-9\-\+\.]+);base64,([^"')]+)\1\)/gi;

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset") continue;
        if (typeof asset.source !== "string") continue;
        if (!fileName.endsWith(".css")) continue;

        let css = asset.source;
        let changed = false;

        css = css.replace(dataUrlRegex, (_match, _quote, mime: string, base64Data: string) => {
          let ext = ".bin";
          if (mime.includes("woff2")) ext = ".woff2";
          else if (mime.includes("woff")) ext = ".woff";
          else if (mime.includes("truetype")) ext = ".ttf";
          else if (mime.includes("opentype")) ext = ".otf";
          else if (mime.includes("svg")) ext = ".svg";
          else if (mime.includes("eot")) ext = ".eot";

          const hash = crypto.createHash("sha256").update(base64Data).digest("hex").slice(0, 16);

          const fontFileName = `assets/fonts/web-components-font-${hash}${ext}`;

          this.emitFile({
            type: "asset",
            fileName: fontFileName,
            source: Buffer.from(base64Data, "base64")
          });

          changed = true;

          return `url("/${fontFileName}")`;
        });

        if (changed) {
          asset.source = css;
        }
      }
    }
  };
};

const nolus = defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      vue(),
      deinlineFontDataUrls(),
      svgLoader(),
      VueI18nPlugin({
        compositionOnly: true,
        strictMessage: false,
        runtimeOnly: false
      }),
      buildWorkerPlugin()
    ],

    define: {
      "import.meta.env.APP_VERSION": JSON.stringify(process.env.npm_package_version),
      // Expose backend URLs to the client (loaded from .env files)
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || ""),
      "import.meta.env.VITE_WS_URL": JSON.stringify(env.VITE_WS_URL || "")
    },
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
      },
      rollupOptions: {
        plugins: [injections]
      }
    }
  };
});

export default nolus;
