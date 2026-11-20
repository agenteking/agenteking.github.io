// Edge Function de Supabase: la API de Selkis (Express 5 + Prisma/Postgres) sin SSR ni estáticos.
// El front vive en GitHub Pages y llama a https://<ref>.supabase.co/functions/v1/selkis/api/…
// Reusa el código del server de Node tal cual (server/src): los paquetes npm salen del import map de
// deno.json (mismas versiones que package.json). Deploy y secrets: README → "Deploy en Supabase".
//
// Env: SUPABASE_DB_URL (la inyecta Supabase: conexión directa a Postgres), DB_SCHEMA (default selkis,
// en env.ts; el entorno del runtime es de solo lectura), ADMIN_KEY (secret), y opcionales CORS_ORIGINS, TRUST_PROXY, DB_POOL_MAX.
import "./env.ts"; // primero: db.ts lee el entorno al cargarse
import process from "node:process";
import { createEdgeApp } from "../../../server/src/edge.ts";

createEdgeApp(process.env, { functionName: "selkis" }).listen(8000);
