import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { MSG, type ErrorCode } from "../../shared/messages.ts";
import { fieldIssues } from "../../shared/schemas.ts";

/** Error con status HTTP: se puede tirar desde cualquier handler (o transacción) y lo responde app.ts. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    public extra: Record<string, unknown> = {},
  ) {
    super(MSG[code]);
  }
}

export function sendError(res: Response, status: number, code: ErrorCode, extra: Record<string, unknown> = {}) {
  res.status(status).json({ error: code, message: MSG[code], ...extra });
}

/** Valida con zod; si falla responde 400 con los mensajes por campo y devuelve undefined. */
export function parse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  res: Response,
  code: "invalid_body" | "invalid_query" = "invalid_body",
): z.output<T> | undefined {
  const r = schema.safeParse(data);
  if (!r.success) {
    sendError(res, 400, code, { issues: fieldIssues(r.error) });
    return undefined;
  }
  return r.data;
}

/** Manejador de errores de Express (va al final de la app): HttpError, body inválido y el resto como 500. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    sendError(res, err.status, err.code, err.extra);
    return;
  }
  // JSON mal formado o demasiado grande (body-parser).
  const status = (err as { status?: number }).status;
  if (status === 400 || status === 413) {
    sendError(res, status, "invalid_body");
    return;
  }
  console.error(err);
  sendError(res, 500, "internal_error");
}
