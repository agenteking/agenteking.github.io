// Piezas comunes de la API, para el server de Node (app.ts: API + SSR + estáticos) y para la
// Edge Function de Supabase (edge.ts: solo API, con CORS).
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { sendError } from "./http.ts";
import { api } from "./routes.ts";

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
  });
  next();
}

/** Body JSON + el router de la API en cada prefijo (y 404 JSON para lo que no exista debajo). */
export function mountApi(app: Express, prefixes: string[]) {
  app.use(express.json({ limit: "20kb" }));
  for (const p of prefixes) {
    app.use(p, api);
    app.use(p, (_req, res) => {
      sendError(res, 404, "not_found");
    });
  }
}
