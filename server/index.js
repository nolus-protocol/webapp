import "./shim.js";
import express from "express";
import cluster from "cluster";
import os from "os";

import { createServer } from "http";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { render } from "../dist/server/entry-server.js";

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, v] = part.split("=").map((s) => s && s.trim());
    if (!k) return;
    out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  });
  return out;
}

const PORT = process.env.PORT || 5050;

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;

  console.log(`Master process ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker process ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  const path = fileURLToPath(new URL("../dist/index.html", import.meta.url));
  const template = readFileSync(path, "utf-8");
  const server = express();
  const base = "/";
  const httpServer = createServer(server);

  httpServer.listen(PORT, () => {
    console.log(`Process: ${process.pid} listening on port ${PORT}`);
  });

  async function initServer() {
    const compression = (await import("compression")).default;
    const sirv = (await import("sirv")).default;

    server.use(compression());
    server.use(base, sirv("./dist", { extensions: [] }));

    server.use("*all", async (req, res) => {
      try {
        const url = req.originalUrl;
        const cookies = parseCookies(req.headers.cookie || "");

        let theme_data = cookies.theme_data;
        let language = cookies.language;

        if (!theme_data) {
          theme_data = "dark";
        }

        if (!language) {
          language = "en";
        }

        const rendered = await render(url, { theme_data, language });

        const html = template
          .replace(`<!--app-head-->`, rendered.head ?? "")
          .replace(`<!--app-theme-->`, theme_data ?? "")
          .replace(`<!--app-html-->`, rendered.html ?? "");

        res.status(200).set({ "Content-Type": "text/html" }).send(html);
      } catch (e) {
        console.error(e.stack);
        res.status(200).set({ "Content-Type": "text/html" }).send(template);
      }
    });
  }

  initServer().catch((e) => console.error(e));
}
