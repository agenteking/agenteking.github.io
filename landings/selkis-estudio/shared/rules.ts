// Reglas de la agenda, puras (sin base de datos): las usan el server y la demo estática.
import type { BusinessHour, Conflict, Slot } from "./types.js";
import { hhmmToMin, localToDate, minToHHMM, toLocalDate, toLocalHHMM, weekdayOf } from "./time.js";

export const SLOT_STEP_MIN = 30;
/** Anticipación mínima para reservar, cambiar o cancelar online. */
export const MIN_LEAD_MIN = 60;
export const MAX_DAYS_AHEAD = 60;
/** Turnos próximos confirmados que puede tener a la vez un mismo celular o email (reserva online). */
export const MAX_ACTIVE_PER_CONTACT = 3;
/** Menos que esto entre que se abre el flujo de reserva y se confirma = bot (ninguna persona elige servicio, día, hora y completa sus datos tan rápido). */
export const MIN_FILL_MS = 4000;
const DAY_MS = 86_400_000;

export interface Interval {
  start: Date;
  end: Date;
}

export interface BusyBooking extends Interval {
  id: string;
  code: string;
  professionalId: string;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export const dayRange = (date: string) => {
  const start = localToDate(date, "00:00");
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/**
 * Horarios libres para una duración en una fecha local (hora de Buenos Aires).
 * Un slot está libre si al menos una de las profesionales no tiene otro turno confirmado
 * que se superponga con [inicio, inicio + duración). `busy` son los turnos confirmados
 * (se ignora `excludeBookingId`: el turno propio cuando la clienta lo está cambiando).
 */
export function computeSlots(opts: {
  date: string;
  durationMin: number;
  professionalIds: string[];
  hours: BusinessHour[];
  busy: BusyBooking[];
  now?: Date;
  excludeBookingId?: string;
}): { slots: Slot[]; closed: boolean } {
  const now = opts.now ?? new Date();
  const hours = opts.hours.find((h) => h.weekday === weekdayOf(opts.date));
  const { start: dayStart } = dayRange(opts.date);
  const maxDate = new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS);
  if (!hours || dayStart > maxDate) return { slots: [], closed: !hours };

  const busy = opts.busy.filter((b) => b.id !== opts.excludeBookingId);
  const earliest = new Date(now.getTime() + MIN_LEAD_MIN * 60_000);
  const closeMin = hhmmToMin(hours.close);
  const slots: Slot[] = [];
  for (let m = hhmmToMin(hours.open); m + opts.durationMin <= closeMin; m += SLOT_STEP_MIN) {
    const time = minToHHMM(m);
    const start = localToDate(opts.date, time);
    if (start < earliest) continue;
    const candidate = { start, end: new Date(start.getTime() + opts.durationMin * 60_000) };
    const free = opts.professionalIds.filter(
      (id) => !busy.some((b) => b.professionalId === id && overlaps(b, candidate)),
    );
    if (free.length > 0) slots.push({ time, start: start.toISOString(), professionalIds: free });
  }
  return { slots, closed: false };
}

/**
 * Chequeos de una carga manual (panel admin). La anticipación mínima NO aplica;
 * todo lo demás se informa como conflicto y el admin puede guardarlo igual (force).
 */
export function placementConflicts(opts: {
  date: string;
  time: string;
  durationMin: number;
  hours: BusinessHour[];
  service: { name: string; active: boolean };
  professional: { id: string; name: string; active: boolean; doesService: boolean };
  busy: BusyBooking[];
  excludeBookingId?: string;
}): Conflict[] {
  const out: Conflict[] = [];
  const start = localToDate(opts.date, opts.time);
  const end = new Date(start.getTime() + opts.durationMin * 60_000);
  if (!opts.service.active) out.push({ type: "inactive_service", message: `El servicio "${opts.service.name}" está desactivado.` });
  if (!opts.professional.active) {
    out.push({ type: "inactive_professional", message: `${opts.professional.name} está desactivada.` });
  }
  if (!opts.professional.doesService) {
    out.push({ type: "professional_service", message: `${opts.professional.name} no tiene cargado "${opts.service.name}".` });
  }
  const hours = opts.hours.find((h) => h.weekday === weekdayOf(opts.date));
  if (!hours) {
    out.push({ type: "closed", message: "El local está cerrado ese día." });
  } else {
    const s = hhmmToMin(opts.time);
    if (s < hhmmToMin(hours.open) || s + opts.durationMin > hhmmToMin(hours.close)) {
      out.push({ type: "outside_hours", message: `Fuera del horario del local (${hours.open} a ${hours.close}).` });
    }
  }
  for (const b of opts.busy) {
    if (b.id === opts.excludeBookingId || b.professionalId !== opts.professional.id) continue;
    if (overlaps(b, { start, end })) {
      out.push({
        type: "overlap",
        message: `Se superpone con el turno ${b.code} (${toLocalHHMM(b.start)}–${toLocalHHMM(b.end)} del ${toLocalDate(b.start)}).`,
      });
    }
  }
  return out;
}

/** La clienta puede cambiar/cancelar online hasta MIN_LEAD_MIN antes del turno. */
export const canCustomerChange = (start: Date, now = new Date()) => start.getTime() - now.getTime() >= MIN_LEAD_MIN * 60_000;

/** "slk-ab12cd", " AB12CD " → "SLK-AB12CD" */
export function normalizeCode(code: string) {
  const c = code.trim().toUpperCase().replace(/\s+/g, "");
  return c.startsWith("SLK-") ? c : c.startsWith("SLK") ? `SLK-${c.slice(3)}` : `SLK-${c}`;
}

/**
 * ¿El dato de contacto coincide con el de la reserva? Email: sin distinguir mayúsculas.
 * Teléfono: los últimos 8 dígitos (así "11 1234-5678" y "+54 9 11 1234 5678" coinciden).
 */
export function contactMatches(contact: string, customer: { phone: string; email: string }) {
  const c = contact.trim();
  if (c.includes("@")) return !!customer.email && c.toLowerCase() === customer.email.trim().toLowerCase();
  const given = c.replace(/\D/g, "");
  const stored = customer.phone.replace(/\D/g, "");
  return given.length >= 8 && stored.length >= 8 && given.slice(-8) === stored.slice(-8);
}

/** "Uñas esculpidas" → "unas-esculpidas" (con sufijo si ya existe). */
export function uniqueSlug(name: string, taken: (id: string) => boolean, prefix = "") {
  const base =
    prefix +
    (name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item");
  let id = base;
  for (let i = 2; taken(id); i++) id = `${base}-${i}`;
  return id;
}

/**
 * Freno anti-bots sin captcha: el campo trampa (`website`, invisible para las personas) vino
 * completo, o el formulario se completó más rápido de lo humanamente posible.
 */
export const looksLikeBot = (d: { website?: string; fillMs: number }) => !!d.website?.trim() || d.fillMs < MIN_FILL_MS;

/** Turnos próximos confirmados del mismo celular o email (para el tope MAX_ACTIVE_PER_CONTACT). */
export function activeForContact(
  bookings: { start: Date; status: string; customerPhone: string; customerEmail: string }[],
  contact: { phone: string; email: string },
  now = new Date(),
) {
  return bookings.filter((b) => {
    if (b.status !== "confirmed" || b.start <= now) return false;
    const customer = { phone: b.customerPhone, email: b.customerEmail };
    return contactMatches(contact.phone, customer) || (!!contact.email && contactMatches(contact.email, customer));
  }).length;
}
