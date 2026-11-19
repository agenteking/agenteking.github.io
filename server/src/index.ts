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

/** Mientras el sitio es una demo (túnel, dominio provisorio) no se indexa. NOINDEX=0 al publicar. */
const noindex = process.env.NOINDEX !== "0";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(compression({ threshold: 512 })); // gzip / brotli según Accept-Encoding
app.use(express.json({ limit: "16kb" }));

app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (noindex) res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use("/api", api);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600");
  if (noindex) {
    res.send("User-agent: *\nDisallow: /\n");
    return;
  }
  const origin = `${req.protocol}://${req.get("host")}`;
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
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
  app.get("/{*splat}", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res.status(req.path === "/" ? 200 : 404).sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : 500;
  if (status >= 500) console.error(err);
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: status === 500 ? "internal_error" : "bad_request" });
});

const port = Number(process.env.PORT ?? 4320);
const server = app.listen(port, () => {
  console.log(`Landing escuchando en http://localhost:${port}${webDist ? "" : " (sin build del front: corré npm run build)"}${noindex ? " · noindex" : ""}`);
});

const shutdown = () => {
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
