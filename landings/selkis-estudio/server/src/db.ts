// Postgres (Supabase) con Prisma 7 + adapter pg. Corre igual en Node (dev, tests, seed) y en Deno
// (la Edge Function de supabase/functions/selkis): por eso no lee .env acá (lo hacen index.ts y el seed).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

/**
 * Conexión y schema de Postgres:
 *   - URL: DATABASE_URL (Node) o SUPABASE_DB_URL (la inyecta Supabase en la Edge Function).
 *   - Schema (uno por cliente: selkis, selkis_test…): ?schema=… en la URL o, si no, DB_SCHEMA; default public.
 *   - SSL: contra un host remoto se cifra siempre (sin validar la CA de Supabase); localhost va sin SSL.
 */
export function dbConfig(env: Record<string, string | undefined> = process.env) {
  const raw = env.DATABASE_URL || env.SUPABASE_DB_URL;
  if (!raw) throw new Error("Falta DATABASE_URL (postgresql://…?schema=selkis): ver README.");
  const u = new URL(raw);
  const schema = u.searchParams.get("schema") || env.DB_SCHEMA || "public";
  u.searchParams.delete("schema");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  const ssl = local || u.searchParams.has("sslmode") ? undefined : { rejectUnauthorized: false };
  return { connectionString: u.toString(), schema, ssl, max: Number(env.DB_POOL_MAX) || 5 };
}

/**
 * Defaults que fija el entry de la Edge Function ANTES de importar esto (allá el entorno es de solo
 * lectura: process.env.X = … tira NotSupported). Lo que venga del entorno real tiene prioridad.
 */
type DbDefaults = { dbDefaults?: Record<string, string> };
const defaults = (globalThis as DbDefaults).dbDefaults ?? {};

const { schema, ...pool } = dbConfig({ ...defaults, ...process.env });

// Tiempos de transacción holgados: contra el pooler desde afuera de la región, abrir una conexión tarda
// hasta ~2 s y cada consulta ~0,1-0,25 s (los defaults de Prisma, 2 s / 5 s, no alcanzan para el seed).
// Dentro de Supabase (Edge Function → Postgres) es ~1 ms por consulta.
export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { schema }),
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});
