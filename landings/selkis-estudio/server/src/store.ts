// Acceso a datos compartido por las rutas públicas, "Gestionar mi turno" y el panel admin.
import { randomBytes } from "node:crypto";
import { computeSlots, type BusyBooking } from "../../shared/rules.js";
import { dayRange } from "../../shared/rules.js";
import { toLocalDate, toLocalHHMM } from "../../shared/time.js";
import type { Booking, BookingEvent, BookingSource, BookingStatus, PublicData } from "../../shared/types.js";
import { prisma } from "./db.js";
import type { Prisma } from "./generated/prisma/client.js";
import { HttpError } from "./http.js";

export type Db = typeof prisma | Prisma.TransactionClient;

export const newCode = () => `SLK-${randomBytes(3).toString("hex").toUpperCase()}`;

/** Código único (reintenta ante la improbable colisión). */
export async function uniqueCode(db: Db) {
  for (;;) {
    const code = newCode();
    if (!(await db.booking.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
}

// ---- Catálogo público (lo que muestra el sitio). La versión invalida el HTML renderizado en ssr.ts. ----
let catalogVersion = 0;
export const getCatalogVersion = () => catalogVersion;
export const bumpCatalog = () => {
  catalogVersion++;
};

export async function getHours(db: Db = prisma) {
  return db.businessHour.findMany({ orderBy: { weekday: "asc" } });
}

/** Servicios activos con al menos una profesional activa, y el equipo activo. */
export async function publicData(): Promise<PublicData> {
  const [services, pros, hours] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        professionals: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, specialty: true },
        },
      },
    }),
    prisma.professional.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { services: { where: { active: true }, select: { id: true } } },
    }),
    getHours(),
  ]);
  return {
    services: services
      .filter((s) => s.professionals.length > 0)
      .map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        durationMin: s.durationMin,
        priceFrom: s.priceFrom,
        professionals: s.professionals,
      })),
    hours: hours.map(({ weekday, open, close }) => ({ weekday, open, close })),
    professionals: pros.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty,
      serviceIds: p.services.map((s) => s.id),
    })),
  };
}

/** Turnos confirmados de esas profesionales que se cruzan con [from, to). */
export async function busyFor(db: Db, professionalIds: string[], from: Date, to: Date): Promise<BusyBooking[]> {
  return db.booking.findMany({
    where: { status: "confirmed", professionalId: { in: professionalIds }, start: { lt: to }, end: { gt: from } },
    select: { id: true, code: true, professionalId: true, start: true, end: true },
  });
}

/**
 * Horarios libres (reglas de la reserva online): servicio y profesionales activos, horario del local,
 * anticipación mínima y sin superposición. `excludeBookingId`: el turno que la clienta está cambiando.
 */
export async function availability(
  db: Db,
  q: { serviceId: string; date: string; professionalId?: string; excludeBookingId?: string; now?: Date },
) {
  const service = await db.service.findFirst({
    where: { id: q.serviceId, active: true },
    include: { professionals: { where: { active: true }, select: { id: true } } },
  });
  if (!service) throw new HttpError(404, "service_not_found");
  const proIds = service.professionals.map((p) => p.id).filter((id) => !q.professionalId || id === q.professionalId);
  if (proIds.length === 0) throw new HttpError(404, "professional_not_found");
  const { start, end } = dayRange(q.date);
  const [hours, busy] = await Promise.all([getHours(db), busyFor(db, proIds, start, end)]);
  const r = computeSlots({
    date: q.date,
    durationMin: service.durationMin,
    professionalIds: proIds,
    hours,
    busy,
    now: q.now,
    excludeBookingId: q.excludeBookingId,
  });
  return { service, ...r };
}

export const bookingInclude = {
  service: { select: { id: true, name: true, durationMin: true, priceFrom: true } },
  professional: { select: { id: true, name: true } },
} as const;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export function serialize(b: BookingRow): Booking {
  return {
    id: b.id,
    code: b.code,
    status: b.status as BookingStatus,
    source: b.source as BookingSource,
    date: toLocalDate(b.start),
    time: toLocalHHMM(b.start),
    endTime: toLocalHHMM(b.end),
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    service: b.service,
    professional: b.professional,
    customer: { name: b.customerName, phone: b.customerPhone, email: b.customerEmail },
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
  };
}

/** "Kapping gel · Profesional A · 2026-11-25 10:00" (para el historial). */
export const describe = (b: BookingRow) => `${b.service.name} · ${b.professional.name} · ${toLocalDate(b.start)} ${toLocalHHMM(b.start)}`;

export async function logEvent(
  db: Db,
  bookingId: string,
  action: BookingEvent["action"],
  actor: BookingEvent["actor"],
  detail = "",
) {
  await db.bookingEvent.create({ data: { bookingId, action, actor, detail } });
}
