import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import { mountApi, securityHeaders } from "./api-app.ts";
import { errorHandler } from "./http.ts";
import { parseTrustProxy } from "./rate-limit.ts";
import { createSsr } from "./ssr.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
// Raíz del proyecto: server/src (dev, tsx) o dist/server/server/src (build).
export const projectRoot =
  [path.resolve(here, "../.."), path.resolve(here, "../../../..")].find((p) => existsSync(path.join(p, "package.json"))) ??
  process.cwd();

export function createApp() {
  const webDist = path.join(projectRoot, "dist/web");
  const hasWeb = existsSync(path.join(webDist, "index.html"));
  const renderIndex = hasWeb ? createSsr(path.join(projectRoot, "dist/ssr")) : null;

  const app = express();
  app.disable("x-powered-by");
  // Off por defecto: req.ip es la IP del socket y X-Forwarded-For se ignora (si no, cualquiera rota la IP
  // y saltea los frenos). Detrás de un proxy/túnel en la misma máquina (cloudflared): TRUST_PROXY=loopback.
  app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
  app.use(compression({ threshold: 512 })); // gzip / brotli según Accept-Encoding
  app.use(securityHeaders);
  mountApi(app, ["/api"]);

  if (hasWeb) {
    // Assets con hash en el nombre: cache de un año, inmutables.
    app.use(
      "/assets",
      express.static(path.join(webDist, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
    );
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, filePath) => {
          if (/\.(avif|webp|jpg|png|svg|woff2|ico)$/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=604800");
        },
      }),
    );
    app.get("/{*splat}", async (req, res) => {
      res.set("Cache-Control", "no-cache");
      // El landing se renderiza con los datos vivos de la base; el resto (p. ej. /admin) es el HTML del build.
      if (renderIndex && req.path === "/") {
        res.type("html").send(await renderIndex());
        return;
      }
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);

  return { app, hasWeb };
}
