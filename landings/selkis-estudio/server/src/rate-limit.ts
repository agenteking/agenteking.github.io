// Frenos en memoria (por IP) y la IP real del cliente. Alcanza para un local: un solo proceso,
// y si se reinicia el server los contadores vuelven a cero (no hace falta Redis).
import type { Request } from "express";

/** Ventana fija: hasta `max` golpes por clave cada `windowMs`. */
export class RateLimiter {
  private buckets = new Map<string, { n: number; reset: number }>();

  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  private bucket(key: string, now: number) {
    let b = this.buckets.get(key);
    if (!b || b.reset <= now) {
      b = { n: 0, reset: now + this.windowMs };
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Segundos hasta poder reintentar (0 = puede seguir). No suma. */
  blockedFor(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    if (!b || b.reset <= now || b.n < this.max) return 0;
    return Math.ceil((b.reset - now) / 1000);
  }

  /** Suma un golpe. */
  hit(key: string, now = Date.now()) {
    this.bucket(key, now).n++;
    if (this.buckets.size > 5000) for (const [k, v] of this.buckets) if (v.reset <= now) this.buckets.delete(k);
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  clear() {
    this.buckets.clear();
  }
}

/**
 * Valor de `trust proxy` a partir de TRUST_PROXY (ver README):
 *   vacío / false / 0 → false (default: req.ip = la IP del socket; X-Forwarded-For se ignora)
 *   loopback          → solo un proxy en la misma máquina (cloudflared, Caddy, nginx local)
 *   N (1, 2…)         → N saltos de proxy delante
 *   lista de IPs/CIDR → "10.0.0.1, 10.0.0.0/8"
 *   true              → confía en cualquier X-Forwarded-For (solo si NADIE puede llegar al server sin pasar por el proxy)
 */
export function parseTrustProxy(raw: string | undefined): boolean | number | string[] {
  const v = (raw ?? "").trim();
  if (!v || /^(false|0|off|no)$/i.test(v)) return false;
  if (/^true$/i.test(v)) return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * IP real del cliente para los frenos. Con `trust proxy` apagado es la del socket (no se puede
 * falsificar con headers). Detrás de Cloudflare (cloudflared), si el que conecta es un proxy de
 * confianza, se usa CF-Connecting-IP; si no, `req.ip` (que ya resolvió X-Forwarded-For según `trust proxy`).
 */
export function clientIp(req: Request): string {
  const peer = req.socket.remoteAddress ?? "";
  const trust = req.app.get("trust proxy fn") as ((addr: string, i: number) => boolean) | undefined;
  const cf = req.get("cf-connecting-ip")?.trim();
  if (cf && peer && trust?.(peer, 0)) return cf;
  return req.ip ?? (peer || "unknown");
}

const MIN = 60_000;
/** Los frenos de la API (los tests los importan para leer los topes). */
export const limits = {
  /** POST /api/bookings: intentos por IP (cuenta todos, también los rechazados). */
  bookings: new RateLimiter(8, 15 * MIN),
  /** Gestionar mi turno: identificaciones fallidas por IP. */
  manage: new RateLimiter(20, 15 * MIN),
  /** Panel: claves incorrectas por IP. Llegado el tope, se frena hasta con la clave correcta. */
  admin: new RateLimiter(5, 15 * MIN),
};
