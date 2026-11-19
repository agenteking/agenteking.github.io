import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Login con UNA contraseña compartida (BACKOFFICE_PASSWORD) y cookie de sesión firmada (HMAC),
 * sin estado en el server: sobrevive a reinicios y se invalida al cambiar la contraseña.
 */

export const COOKIE = "bo_session";
const MAX_AGE_S = 30 * 24 * 3600;

export interface AuthConfig {
  password: string;
  secret: Buffer;
}

export function authConfig(password: string | undefined, sessionSecret: string | undefined): AuthConfig {
  if (!password || password.length < 12) {
    throw new Error("Falta BACKOFFICE_PASSWORD (mínimo 12 caracteres).");
  }
  const secret = createHash("sha256")
    .update(sessionSecret ? `secret\0${sessionSecret}` : `aparece-backoffice-session\0${password}`)
    .digest();
  return { password, secret };
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function passwordOk(cfg: AuthConfig, attempt: unknown): boolean {
  if (typeof attempt !== "string" || attempt.length > 512) return false;
  return timingSafeEqual(digest(attempt), digest(cfg.password));
}

function sign(cfg: AuthConfig, payload: string): string {
  return createHmac("sha256", cfg.secret).update(payload).digest("base64url");
}

export function newSessionValue(cfg: AuthConfig, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_S;
  return `${exp}.${sign(cfg, `v1.${exp}`)}`;
}

export function sessionValid(cfg: AuthConfig, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  if (!expStr || !sig || !/^\d+$/.test(expStr)) return false;
  if (Number(expStr) * 1000 < now) return false;
  const want = Buffer.from(sign(cfg, `v1.${expStr}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** https detrás de Cloudflare (X-Forwarded-Proto con trust proxy = loopback). */
const isHttps = (req: Request) => req.secure;

export function setSessionCookie(cfg: AuthConfig, req: Request, res: Response) {
  res.cookie(COOKIE, newSessionValue(cfg), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    maxAge: MAX_AGE_S * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/" });
}

/** Todo lo que no sea /login pasa por acá: API → 401, páginas → redirect a /login. */
export function requireSession(cfg: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (sessionValid(cfg, readCookie(req, COOKIE))) {
      next();
      return;
    }
    if (req.path.startsWith("/api/") || req.path === "/api" || req.method !== "GET") {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const nextPath = req.originalUrl.startsWith("/") && !req.originalUrl.startsWith("//") ? req.originalUrl : "/";
    res.redirect(302, `/login${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}`);
  };
}

/** Las mutaciones solo con JSON y del mismo origen (CSRF: sumado a la cookie SameSite=Lax). */
export function sameOriginJson(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin) {
    let host: string | null = null;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (host !== req.get("host")) {
      res.status(403).json({ error: "bad_origin" });
      return;
    }
  }
  if (!req.is("application/json")) {
    res.status(415).json({ error: "json_required" });
    return;
  }
  next();
}

// --------------------------------------------------------------------------- rate limit del login

const WINDOW_MS = 15 * 60_000;
const PER_IP = 5;
const GLOBAL = 40;

interface Bucket {
  fails: number;
  resetAt: number;
}

export class LoginLimiter {
  private perIp = new Map<string, Bucket>();
  private global: Bucket = { fails: 0, resetAt: 0 };

  private bucket(ip: string, now: number): Bucket {
    let b = this.perIp.get(ip);
    if (!b || b.resetAt <= now) {
      b = { fails: 0, resetAt: now + WINDOW_MS };
      this.perIp.set(ip, b);
    }
    if (this.global.resetAt <= now) this.global = { fails: 0, resetAt: now + WINDOW_MS };
    return b;
  }

  /** ms hasta poder reintentar (0 = puede intentar). */
  blockedFor(ip: string, now = Date.now()): number {
    const b = this.bucket(ip, now);
    if (b.fails >= PER_IP) return b.resetAt - now;
    if (this.global.fails >= GLOBAL) return this.global.resetAt - now;
    return 0;
  }

  fail(ip: string, now = Date.now()) {
    this.bucket(ip, now).fails++;
    this.global.fails++;
    if (this.perIp.size > 5000) {
      for (const [k, v] of this.perIp) if (v.resetAt <= now) this.perIp.delete(k);
    }
  }

  success(ip: string) {
    this.perIp.delete(ip);
  }
}

/** IP real: Cloudflare la pone en CF-Connecting-IP (el server solo escucha en 127.0.0.1). */
export function clientIp(req: Request): string {
  return req.get("cf-connecting-ip") || req.ip || "unknown";
}
