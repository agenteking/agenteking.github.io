import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./db.js";
import { api } from "./routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/server/index.js → dist/web ; server/src/index.ts (dev) → dist/web
const webDist = [path.resolve(here, "../web"), path.resolve(here, "../../dist/web")].find((p) =>
  existsSync(path.join(p, "index.html")),
);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
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
  res.status(404).json({ error: "not_found" });
});

if (webDist) {
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
  app.get("/{*splat}", (_req, res) => {
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT ?? 4310);
const server = app.listen(port, () => {
  console.log(`Selkis demo escuchando en http://localhost:${port}${webDist ? "" : " (sin build del front: corré npm run build)"}`);
});

const shutdown = () => {
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
