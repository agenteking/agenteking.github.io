import type { LeadRow } from "../../server/src/domain";

const RUBROS: Record<string, string> = {
  estetica: "Estética",
  inmobiliarias: "Inmobiliarias",
  peluqueria_barberia: "Peluquería y barbería",
  gimnasios_pilates_yoga: "Gimnasio, pilates y yoga",
  odontologia: "Odontología",
  salud_independiente: "Salud independiente",
  salones_eventos: "Salones de eventos",
  geriatricos: "Geriátricos",
  veterinarias: "Veterinarias",
  estudios_juridicos: "Estudios jurídicos",
  profesionales_salud_mental_nutricion: "Salud mental y nutrición",
  restaurantes: "Restaurantes",
  muebles: "Muebles",
  idiomas_academias: "Idiomas y academias",
  jardines_maternales: "Jardines maternales",
  panaderias_tortas: "Panaderías y tortas",
  opticas: "Ópticas",
  talleres_mecanicos: "Talleres mecánicos",
  servicios_tecnicos_hogar: "Servicio técnico",
  cerrajerias: "Cerrajerías",
  floristerias_viveros: "Florerías y viveros",
  tatuadores: "Tatuadores",
  cafes: "Cafés",
  estudios_contables: "Estudios contables",
  dieteticas: "Dietéticas",
  fotografos: "Fotógrafos",
  lavaderos_autos: "Lavaderos de autos",
  ferreterias_pinturerias: "Ferreterías y pinturerías",
  bicicleterias: "Bicicleterías",
  canchas: "Canchas",
  hoteles_familiares: "Hoteles familiares",
  lavaderos_ropa: "Lavaderos de ropa",
};

export function rubroLabel(id: string | null): string {
  if (!id) return "Sin rubro";
  return RUBROS[id] ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");
}

const DAY = 86_400_000;
const fmtShort = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });
const fmtLong = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

/** "hoy", "ayer", "hace 3 días", "12 nov". */
export function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((Date.parse(dayKey.format(new Date())) - Date.parse(dayKey.format(d))) / DAY);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return fmtShort.format(d).replace(".", "");
}

export function longDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : fmtLong.format(d);
}

export const digits = (s: string) => s.replace(/\D/g, "");

/** Teléfono para mostrar: el publicado, o el normalizado. */
export function phoneLabel(l: Pick<LeadRow, "phone" | "phone_norm">): string | null {
  return l.phone || l.phone_norm;
}

export function telHref(l: Pick<LeadRow, "phone" | "phone_norm">): string | null {
  if (l.phone_norm) return `tel:${l.phone_norm}`;
  if (l.phone) return `tel:${digits(l.phone)}`;
  return null;
}

/**
 * Link de WhatsApp: el WhatsApp publicado; si no, el celular. En CABA los 011 que no empiezan con 4 o 5
 * suelen ser celulares publicados sin el 15: se ofrece el link marcado como "probable".
 */
export function waLink(l: Pick<LeadRow, "whatsapp" | "phone_norm">): { href: string; probable: boolean } | null {
  const w = l.whatsapp ? digits(l.whatsapp) : "";
  if (w.length >= 10) return { href: `https://wa.me/${w}`, probable: false };
  const p = l.phone_norm ?? "";
  if (p.startsWith("+549")) return { href: `https://wa.me/${digits(p)}`, probable: false };
  const m = /^\+5411(\d{8})$/.exec(p);
  if (m && !/^[45]/.test(m[1]!)) return { href: `https://wa.me/54911${m[1]}`, probable: true };
  return null;
}

export function mapsHref(l: { maps_url: string | null; address: string | null; name: string }): string | null {
  if (l.maps_url) return l.maps_url;
  if (l.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name}, ${l.address}`)}`;
  return null;
}

export function igHandle(url: string | null): string | null {
  if (!url) return null;
  const m = /instagram\.com\/([A-Za-z0-9_.]+)/.exec(url);
  return m ? `@${m[1]}` : url;
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
}

/** Dirección sin el "C1406ARK Cdad. Autónoma de Buenos Aires" del final. */
export function shortAddress(a: string | null): string | null {
  if (!a) return null;
  return a.replace(/,\s*C\d{4}(?:\s*[A-Z]{3})?\b\s*/, ", ").replace(/,?\s*Cdad\. Autónoma de Buenos Aires\s*$/i, "").replace(/,\s*$/, "");
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
