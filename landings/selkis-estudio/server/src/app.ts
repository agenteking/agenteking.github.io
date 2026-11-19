import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import { HttpError, sendError } from "./http.js";
import { parseTrustProxy } from "./rate-limit.js";
import { api } from "./routes.js";
import { createSsr } from "./ssr.js";

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
  app.use(express.json({ limit: "20kb" }));

  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
    });
    next();
  });

  app.use("/api", api);
  app.use("/api", (_req, res) => {
    sendError(res, 404, "not_found");
  });

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

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      sendError(res, err.status, err.code, err.extra);
      return;
    }
    // JSON mal formado o demasiado grande (body-parser).
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 413) {
      sendError(res, status, "invalid_body");
      return;
    }
    console.error(err);
    sendError(res, 500, "internal_error");
  });

  return { app, hasWeb };
}
