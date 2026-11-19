import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const { app, hasWeb } = createApp();

const port = Number(process.env.PORT ?? 4310);
const server = app.listen(port, () => {
  console.log(`Selkis demo escuchando en http://localhost:${port}${hasWeb ? "" : " (sin build del front: corré npm run build)"}`);
});

const shutdown = () => {
  server.close(() => void prisma.$disconnect().finally(() => process.exit(0)));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
