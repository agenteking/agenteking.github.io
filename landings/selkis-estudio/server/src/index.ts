import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const { app, hasWeb } = createApp();

// Avisos de configuración (no frenan el arranque: es una demo).
if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY === "cambiame" || process.env.ADMIN_KEY.length < 12) {
  console.warn("Aviso: ADMIN_KEY vacía, de ejemplo o corta: generá una con `openssl rand -base64 24` antes de darle el panel a alguien.");
}
if (/^true$/i.test(process.env.TRUST_PROXY ?? "")) {
  console.warn("Aviso: TRUST_PROXY=true confía en cualquier X-Forwarded-For: usá loopback o la cantidad de saltos (README).");
}
if (!process.env.SITE_URL) console.warn("Aviso: sin SITE_URL: el canonical y el JSON-LD apuntan a localhost.");

const port = Number(process.env.PORT ?? 4310);
const server = app.listen(port, () => {
  console.log(`Selkis demo escuchando en http://localhost:${port}${hasWeb ? "" : " (sin build del front: corré npm run build)"}`);
});

const shutdown = () => {
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
