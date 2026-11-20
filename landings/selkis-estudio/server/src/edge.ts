// API sola (sin SSR ni estáticos) para la Edge Function de Supabase (supabase/functions/selkis/index.ts).
// También se usa desde Node en los tests, así lo que corre en Supabase está cubierto.
import express from "express";
import { mountApi, securityHeaders } from "./api-app.ts";
import { cors, parseOrigins } from "./cors.ts";
import { errorHandler, sendError } from "./http.ts";
import { parseTrustProxy } from "./rate-limit.ts";

/**
 * Supabase le pasa a Express la ruta con el nombre de la función adelante:
 * https://<ref>.supabase.co/functions/v1/selkis/api/x llega como /selkis/api/x. Se monta en los dos.
 *
 * IP del cliente (frenos): el gateway de Supabase (un Worker de Cloudflare) REESCRIBE X-Forwarded-For
 * ("<cliente>,<cliente>, <ip del gateway>") y pone CF-Connecting-IP con la IP real; un CF-Connecting-IP
 * mandado por el cliente lo corta Cloudflare (error 1000) y el X-Forwarded-For propio se descarta. Adentro
 * el socket es 0.0.0.0, así que acá TRUST_PROXY default = true (a la función solo se llega por el gateway):
 * clientIp() usa CF-Connecting-IP y req.ip el primer X-Forwarded-For. Verificado el 2026-11-19 (README).
 */
export function createEdgeApp(
  env: Record<string, string | undefined> = process.env,
  opts: { functionName?: string } = {},
) {
  const name = opts.functionName ?? env.FUNCTION_NAME ?? "selkis";
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY ?? "true"));
  app.use(cors(parseOrigins(env.CORS_ORIGINS), { allowLocalhost: env.CORS_ALLOW_LOCALHOST !== "0" }));
  app.use(securityHeaders);
  mountApi(app, [`/${name}/api`, "/api"]);
  app.use((_req, res) => {
    sendError(res, 404, "not_found");
  });
  app.use(errorHandler);
  return app;
}
