import type { Booking } from "../api";
import { business } from "../content";

const TZ = "America/Argentina/Buenos_Aires";

export const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD

export const dayParts = (date: string) => {
  const d = new Date(`${date}T12:00:00-03:00`);
  return {
    wd: new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: TZ }).format(d).replace(".", ""),
    day: new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: TZ }).format(d),
    month: new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TZ }).format(d).replace(".", ""),
    long: new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d),
    weekday: d.getUTCDay(),
  };
};

/** Los próximos n días (YYYY-MM-DD, hora de Buenos Aires), desde hoy. */
export function nextDays(n: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) out.push(ymd(new Date(now + i * 86_400_000)));
  return out;
}

export function gcalLink(b: Booking) {
  const fmt = (date: string, time: string) => {
    const d = new Date(`${date}T${time}:00-03:00`);
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.service.name} · Selkis Estudio`,
    dates: `${fmt(b.date, b.time)}/${fmt(b.date, b.endTime)}`,
    details: `Código de reserva ${b.code} (turno de demo)`,
    location: `${business.address}, ${business.area}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
