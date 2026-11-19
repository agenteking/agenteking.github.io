import "dotenv/config"; // DOTENV_CONFIG_PATH=/ruta/al/.env (ver scripts/start.sh)
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  LoginLimiter,
  authConfig,
  clearSessionCookie,
  clientIp,
  passwordOk,
  requireSession,
  sameOriginJson,
  sessionValid,
  readCookie,
  COOKIE,
  setSessionCookie,
} from "./auth.js";
import { LeadsRepo, openDb } from "./db.js";
import { loginPage } from "./login-page.js";
import { api } from "./routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/server/index.js → dist/web ; server/src/index.ts (dev) → dist/web
const webDist = [path.resolve(here, "../web"), path.resolve(here, "../../dist/web")].find((p) =>
  existsSync(path.join(p, "index.html")),
);
const favicon = [path.resolve(here, "../web/favicon.svg"), path.resolve(here, "../../web/public/favicon.svg")].find((p) =>
  existsSync(p),
);

const dbFile = process.env.LEADS_DB;
if (!dbFile) throw new Error("Falta LEADS_DB (ruta a data/leads/leads.db).");
const cfg = authConfig(process.env.BACKOFFICE_PASSWORD, process.env.SESSION_SECRET);
const db = openDb(dbFile);
const repo = new LeadsRepo(db);
const limiter = new LoginLimiter();

const safeNext = (v: unknown) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && v.length < 500 ? v : "/";

const app = express();
app.disable("x-powered-by");
// Solo confiamos en el proxy local (cloudflared): X-Forwarded-Proto → req.secure.
app.set("trust proxy", "loopback");
app.use(compression({ threshold: 512 }));

app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
      "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  next();
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nDisallow: /\n");
});
if (favicon) app.get("/favicon.svg", (_req, res) => res.sendFile(favicon));

// ---------------------------------------------------------------- login / logout (lo único público)

app.get("/login", (req, res) => {
  const next = safeNext(req.query.next);
  if (sessionValid(cfg, readCookie(req, COOKIE))) {
    res.redirect(302, next);
    return;
  }
  res.set("Cache-Control", "no-store").type("html").send(loginPage({ next }));
});

app.post("/login", express.urlencoded({ extended: false, limit: "4kb" }), async (req, res) => {
  const ip = clientIp(req);
  const next = safeNext(req.body?.next);
  res.set("Cache-Control", "no-store");
  const wait = limiter.blockedFor(ip);
  if (wait > 0) {
    const min = Math.ceil(wait / 60_000);
    res.status(429).type("html").send(loginPage({ next, error: `Demasiados intentos. Probá de nuevo en ${min} min.` }));
    return;
  }
  if (!passwordOk(cfg, req.body?.password)) {
    limiter.fail(ip);
    await new Promise((r) => setTimeout(r, 400));
    res.status(401).type("html").send(loginPage({ next, error: "Contraseña incorrecta." }));
    return;
  }
  limiter.success(ip);
  setSessionCookie(cfg, req, res);
  res.redirect(303, next);
});

app.post("/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.redirect(303, "/login");
});

// ---------------------------------------------------------------- todo lo demás, con sesión

app.use(requireSession(cfg));

app.use("/api", express.json({ limit: "32kb" }), sameOriginJson, (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", api(repo));
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

if (webDist) {
  app.use(
    "/assets",
    express.static(path.join(webDist, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
  );
  app.use(express.static(webDist, { index: false }));
  app.get("/{*splat}", (_req, res) => {
    res.set("Cache-Control", "no-cache").sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : 500;
  if (status >= 500) console.error(err);
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: status >= 500 ? "internal_error" : "bad_request" });
});

const port = Number(process.env.PORT ?? 4460);
// Solo localhost: desde afuera se entra por el túnel de Cloudflare.
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Back office en http://localhost:${port} · base ${dbFile}${webDist ? "" : " (sin build del front: npm run build)"}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
