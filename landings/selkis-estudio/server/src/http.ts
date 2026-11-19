import type { Response } from "express";
import type { z } from "zod";
import { MSG, type ErrorCode } from "../../shared/messages.js";
import { fieldIssues } from "../../shared/schemas.js";

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
