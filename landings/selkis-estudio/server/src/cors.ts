// CORS para la API servida desde otro origen (la Edge Function de Supabase, con el front en GitHub Pages).
import type { NextFunction, Request, Response } from "express";

export const DEFAULT_CORS_ORIGINS = ["https://agenteking.github.io"];

/** CORS_ORIGINS="https://a.com,https://b.com" (sin barra final). Vacío: GitHub Pages de la agencia. */
export function parseOrigins(raw: string | undefined): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return list.length ? list : DEFAULT_CORS_ORIGINS;
}

/** Cualquier puerto de localhost / 127.0.0.1 (vite dev y preview). */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function originAllowed(origin: string, allowed: string[], allowLocalhost = true) {
  return allowed.includes(origin) || (allowLocalhost && LOCAL.test(origin));
}

/**
 * Solo los orígenes permitidos reciben Access-Control-Allow-Origin (sin credenciales: la clave del panel
 * va en el header x-admin-key, que por eso se permite en el preflight). OPTIONS se contesta acá con 204.
 */
export function cors(allowed: string[], opts: { allowLocalhost?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    res.vary("Origin");
    const ok = !!origin && originAllowed(origin, allowed, opts.allowLocalhost ?? true);
    if (ok) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Expose-Headers", "Retry-After");
    }
    if (req.method === "OPTIONS") {
      if (ok) {
        res.set({
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
          "Access-Control-Max-Age": "86400",
        });
      }
      res.status(204).end();
      return;
    }
    next();
  };
}
