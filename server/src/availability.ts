import { prisma } from "./db.js";
import { hhmmToMin, localToDate, minToHHMM, weekdayOf } from "./time.js";

export const SLOT_STEP_MIN = 30;
/** Anticipación mínima para reservar online. */
export const MIN_LEAD_MIN = 60;
export const MAX_DAYS_AHEAD = 60;

export interface Slot {
  time: string; // "HH:MM" hora BA
  start: string; // ISO UTC
  professionalIds: string[];
}

type Interval = { start: Date; end: Date };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

type Db = Pick<typeof prisma, "service" | "businessHour" | "booking">;

/**
 * Horarios libres para un servicio en una fecha local.
 * Un slot está libre si al menos un/a profesional que hace el servicio no tiene
 * otro turno confirmado que se superponga con [inicio, inicio + duración).
 */
export async function getAvailability(
  serviceId: string,
  date: string,
  professionalId?: string,
  db: Db = prisma,
  now = new Date(),
) {
  const service = await db.service.findFirst({
    where: { id: serviceId, active: true },
    include: { professionals: true },
  });
  if (!service) return { error: "service_not_found" as const };

  const pros = service.professionals.filter((p) => !professionalId || p.id === professionalId);
  if (pros.length === 0) return { error: "professional_not_found" as const };

  const hours = await db.businessHour.findUnique({ where: { weekday: weekdayOf(date) } });
  const dayStart = localToDate(date, "00:00");
  const maxDate = new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000);
  if (!hours || dayStart > maxDate) return { service, slots: [] as Slot[], closed: !hours };

  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const bookings = await db.booking.findMany({
    where: {
      status: "confirmed",
      professionalId: { in: pros.map((p) => p.id) },
      start: { lt: dayEnd },
      end: { gt: dayStart },
    },
    select: { professionalId: true, start: true, end: true },
  });

  const earliest = new Date(now.getTime() + MIN_LEAD_MIN * 60_000);
  const openMin = hhmmToMin(hours.open);
  const closeMin = hhmmToMin(hours.close);
  const slots: Slot[] = [];

  for (let m = openMin; m + service.durationMin <= closeMin; m += SLOT_STEP_MIN) {
    const time = minToHHMM(m);
    const start = localToDate(date, time);
    if (start < earliest) continue;
    const candidate = { start, end: new Date(start.getTime() + service.durationMin * 60_000) };
    const free = pros
      .filter((p) => !bookings.some((b) => b.professionalId === p.id && overlaps(b, candidate)))
      .map((p) => p.id);
    if (free.length > 0) slots.push({ time, start: start.toISOString(), professionalIds: free });
  }
  return { service, slots, closed: false };
}
