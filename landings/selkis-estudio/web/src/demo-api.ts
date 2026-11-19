// Backend simulado en el navegador para la demo estática (GitHub Pages, VITE_STATIC_DEMO=1).
// Mismos datos iniciales (shared/seed-data), mismas reglas (shared/rules), misma validación
// (shared/schemas, zod) y mismos errores (shared/messages) que el server Express.
// Todo se guarda en localStorage de este navegador (si no hay storage, queda en memoria);
// el sitio y el panel /admin lo comparten, así que un cambio del panel se ve en el sitio.
import type { z } from "zod";
import { MSG, type ErrorCode } from "../../shared/messages";
import {
  MAX_ACTIVE_PER_CONTACT,
  activeForContact,
  looksLikeBot,
  canCustomerChange,
  computeSlots,
  contactMatches,
  dayRange,
  normalizeCode,
  overlaps,
  placementConflicts,
  uniqueSlug,
  type BusyBooking,
} from "../../shared/rules";
import {
  adminBookingBody,
  adminBookingQuery,
  availabilityQuery,
  bookingBody,
  fieldIssues,
  manageAuth,
  manageAvailability,
  manageChange,
  professionalBody,
  serviceBody,
} from "../../shared/schemas";
import { SEED_HOURS, SEED_PROFESSIONALS, SEED_SERVICES } from "../../shared/seed-data";
import { localToDate, toLocalDate, toLocalHHMM } from "../../shared/time";
import type {
  AdminProfessional,
  AdminService,
  Booking,
  BookingEvent,
  BookingSource,
  BookingStatus,
  MyBooking,
  PublicData,
} from "../../shared/types";
import { ApiError, type Backend } from "./api";

// ---- "Base de datos" en localStorage ----
interface DbService {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  priceFrom: number;
  active: boolean;
  sortOrder: number;
}
interface DbProfessional {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
  sortOrder: number;
  /** Relación profesional ↔ servicio (vive solo acá). */
  serviceIds: string[];
}
interface DbBooking {
  id: string;
  code: string;
  status: BookingStatus;
  source: BookingSource;
  serviceId: string;
  professionalId: string;
  start: string; // ISO UTC
  end: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}
interface DbEvent extends BookingEvent {
  bookingId: string;
}
interface Db {
  version: 2;
  services: DbService[];
  professionals: DbProfessional[];
  bookings: DbBooking[];
  events: DbEvent[];
}

const KEY = "selkis-demo-v2";
const OLD_KEY = "selkis-demo-bookings"; // versión anterior de la demo: solo turnos
let memory: Db | null = null;

function seed(): Db {
  return {
    version: 2,
    services: SEED_SERVICES.map((s, i) => ({ ...s, active: true, sortOrder: i })),
    professionals: SEED_PROFESSIONALS.map(({ services, ...p }, i) => ({ ...p, active: true, sortOrder: i, serviceIds: services })),
    bookings: [],
    events: [],
  };
}

/** Lee siempre de localStorage: el panel (otra pestaña) puede haber cambiado algo. */
function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed?.version === 2) return (memory = parsed);
    }
    const db = seed();
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const list = JSON.parse(old) as Partial<DbBooking>[];
      if (Array.isArray(list)) {
        db.bookings = list.map((b) => ({
          source: "online",
          notes: "",
          updatedAt: b.createdAt ?? new Date().toISOString(),
          cancelledAt: null,
          ...b,
        })) as DbBooking[];
      }
    }
    return (memory = db);
  } catch {
    return (memory ??= seed()); // sin storage: seguimos en memoria
  }
}

function save(db: Db) {
  memory = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* sin storage: queda en memoria hasta recargar */
  }
}

// ---- Helpers ----
const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

function fail(status: number, code: ErrorCode, extra: Record<string, unknown> = {}): never {
  throw new ApiError(status, { error: code, message: MSG[code], ...extra });
}

function parse<T extends z.ZodType>(schema: T, data: unknown, code: "invalid_body" | "invalid_query" = "invalid_body"): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) fail(400, code, { issues: fieldIssues(r.error) });
  return r.data;
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const newId = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : randomHex(16));
function uniqueCode(db: Db) {
  for (;;) {
    const code = `SLK-${randomHex(3).toUpperCase()}`;
    if (!db.bookings.some((b) => b.code === code)) return code;
  }
}

/** Demo estática: cualquier clave no vacía entra (no hay secreto que proteger: los datos viven en tu navegador). */
function requireAdmin(key: string) {
  if (!key.trim()) fail(401, "unauthorized");
}

const byOrder = <T extends { sortOrder: number; name: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

function serialize(db: Db, b: DbBooking): Booking {
  const s = db.services.find((x) => x.id === b.serviceId);
  const p = db.professionals.find((x) => x.id === b.professionalId);
  const start = new Date(b.start);
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    source: b.source,
    date: toLocalDate(start),
    time: toLocalHHMM(start),
    endTime: toLocalHHMM(new Date(b.end)),
    start: b.start,
    end: b.end,
    service: { id: b.serviceId, name: s?.name ?? b.serviceId, durationMin: s?.durationMin ?? 0, priceFrom: s?.priceFrom ?? 0 },
    professional: { id: b.professionalId, name: p?.name ?? b.professionalId },
    customer: { name: b.customerName, phone: b.customerPhone, email: b.customerEmail },
    notes: b.notes,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    cancelledAt: b.cancelledAt,
  };
}

const describe = (db: Db, b: DbBooking) => {
  const s = serialize(db, b);
  return `${s.service.name} · ${s.professional.name} · ${s.date} ${s.time}`;
};

function logEvent(db: Db, bookingId: string, action: BookingEvent["action"], actor: BookingEvent["actor"], detail: string) {
  db.events.push({ id: newId(), bookingId, action, actor, detail, createdAt: new Date().toISOString() });
}

function busyFor(db: Db, proIds: string[], from: Date, to: Date): BusyBooking[] {
  return db.bookings
    .filter((b) => b.status === "confirmed" && proIds.includes(b.professionalId))
    .map((b) => ({ id: b.id, code: b.code, professionalId: b.professionalId, start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => overlaps(b, { start: from, end: to }));
}

/** Igual que availability() de server/src/store.ts. */
function availability(db: Db, q: { serviceId: string; date: string; professionalId?: string; excludeBookingId?: string }) {
  const service = db.services.find((s) => s.id === q.serviceId && s.active);
  if (!service) fail(404, "service_not_found");
  const proIds = db.professionals
    .filter((p) => p.active && p.serviceIds.includes(service.id))
    .map((p) => p.id)
    .filter((id) => !q.professionalId || id === q.professionalId);
  if (proIds.length === 0) fail(404, "professional_not_found");
  const { start, end } = dayRange(q.date);
  const r = computeSlots({
    date: q.date,
    durationMin: service.durationMin,
    professionalIds: proIds,
    hours: SEED_HOURS,
    busy: busyFor(db, proIds, start, end),
    excludeBookingId: q.excludeBookingId,
  });
  return { service, ...r };
}

function publicData(db: Db): PublicData {
  const pros = db.professionals.filter((p) => p.active).sort(byOrder);
  const services = db.services
    .filter((s) => s.active)
    .sort(byOrder)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      durationMin: s.durationMin,
      priceFrom: s.priceFrom,
      professionals: pros.filter((p) => p.serviceIds.includes(s.id)).map(({ id, name, specialty }) => ({ id, name, specialty })),
    }))
    .filter((s) => s.professionals.length > 0);
  const activeIds = new Set(db.services.filter((s) => s.active).map((s) => s.id));
  return {
    services,
    hours: SEED_HOURS,
    professionals: pros.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty,
      serviceIds: p.serviceIds.filter((id) => activeIds.has(id)),
    })),
  };
}

// ---- Gestionar mi turno ----
function findOwned(db: Db, auth: { code: string; contact: string }) {
  const b = db.bookings.find((x) => x.code === normalizeCode(auth.code));
  if (!b || !contactMatches(auth.contact, { phone: b.customerPhone, email: b.customerEmail })) fail(404, "booking_not_found");
  return b;
}
const mine = (db: Db, b: DbBooking): MyBooking => ({
  ...serialize(db, b),
  canChange: b.status === "confirmed" && canCustomerChange(new Date(b.start)),
});
function assertChangeable(b: DbBooking) {
  if (b.status !== "confirmed") fail(409, "booking_cancelled");
  if (!canCustomerChange(new Date(b.start))) fail(409, "too_late");
}

// ---- Admin ----
function counts(db: Db, field: "serviceId" | "professionalId", id: string) {
  const now = new Date().toISOString();
  const list = db.bookings.filter((b) => b[field] === id);
  return { futureBookings: list.filter((b) => b.status === "confirmed" && b.start >= now).length, totalBookings: list.length };
}
const adminService = (db: Db, s: DbService): AdminService => ({
  ...s,
  professionalIds: db.professionals.filter((p) => p.serviceIds.includes(s.id)).map((p) => p.id),
  ...counts(db, "serviceId", s.id),
});
const adminProfessional = (db: Db, p: DbProfessional): AdminProfessional => ({ ...p, ...counts(db, "professionalId", p.id) });

function assertDeletable(db: Db, field: "serviceId" | "professionalId", id: string) {
  const c = counts(db, field, id);
  if (c.futureBookings > 0) fail(409, "has_future_bookings", { futureBookings: c.futureBookings });
  if (c.totalBookings > 0) fail(409, "has_history", { totalBookings: c.totalBookings });
}

function checkPlacement(
  db: Db,
  d: { serviceId: string; professionalId: string; date: string; time: string },
  excludeBookingId?: string,
) {
  const service = db.services.find((s) => s.id === d.serviceId);
  if (!service) fail(404, "service_not_found");
  const pro = db.professionals.find((p) => p.id === d.professionalId);
  if (!pro) fail(404, "professional_not_found");
  const start = localToDate(d.date, d.time);
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const conflicts = placementConflicts({
    date: d.date,
    time: d.time,
    durationMin: service.durationMin,
    hours: SEED_HOURS,
    service,
    professional: { id: pro.id, name: pro.name, active: pro.active, doesService: pro.serviceIds.includes(service.id) },
    busy: busyFor(db, [pro.id], start, end),
    excludeBookingId,
  });
  return { start, end, conflicts };
}

/** Asigna la relación servicio ↔ profesionales desde el lado del servicio. */
function setServicePros(db: Db, serviceId: string, proIds: string[] | undefined) {
  if (!proIds) return;
  for (const p of db.professionals) {
    const has = p.serviceIds.includes(serviceId);
    const want = proIds.includes(p.id);
    if (want && !has) p.serviceIds = [...p.serviceIds, serviceId];
    if (!want && has) p.serviceIds = p.serviceIds.filter((id) => id !== serviceId);
  }
}

const findOr404 = <T extends { id: string }>(list: T[], id: string): T => list.find((x) => x.id === id) ?? fail(404, "not_found");

export const demoBackend: Backend = {
  async getServices() {
    return delay(publicData(load()));
  },

  async getAvailability(serviceId, date, professionalId) {
    const q = parse(availabilityQuery, { serviceId, date, professionalId }, "invalid_query");
    const r = availability(load(), q);
    return delay({ slots: r.slots, closed: r.closed, durationMin: r.service.durationMin });
  },

  async createBooking(data) {
    const d = parse(bookingBody, data);
    // Mismos frenos que Express (salvo el límite por IP, que en el navegador no tiene sentido).
    if (looksLikeBot(d)) fail(400, "bot_suspected");
    const db = load();
    const avail = availability(db, d);
    const slot = avail.slots.find((s) => s.time === d.time) ?? fail(409, "slot_unavailable");
    const upcoming = db.bookings.map((x) => ({ ...x, start: new Date(x.start) }));
    if (activeForContact(upcoming, { phone: d.phone, email: d.email }) >= MAX_ACTIVE_PER_CONTACT) fail(409, "too_many_bookings");
    const start = localToDate(d.date, d.time);
    const now = new Date().toISOString();
    const b: DbBooking = {
      id: newId(),
      code: uniqueCode(db),
      status: "confirmed",
      source: "online",
      serviceId: d.serviceId,
      professionalId: d.professionalId ?? slot.professionalIds[0]!,
      start: start.toISOString(),
      end: new Date(start.getTime() + avail.service.durationMin * 60_000).toISOString(),
      customerName: d.name,
      customerPhone: d.phone,
      customerEmail: d.email,
      notes: "",
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
    };
    db.bookings.push(b);
    logEvent(db, b.id, "created", "customer", describe(db, b));
    save(db);
    return delay(serialize(db, b));
  },

  async findMyBooking(auth) {
    const a = parse(manageAuth, auth);
    const db = load();
    return delay(mine(db, findOwned(db, a)));
  },

  async myAvailability(q) {
    const d = parse(manageAvailability, q);
    const db = load();
    const b = findOwned(db, d);
    const r = availability(db, { ...d, excludeBookingId: b.id });
    return delay({ slots: r.slots, closed: r.closed, durationMin: r.service.durationMin });
  },

  async changeMyBooking(data) {
    const d = parse(manageChange, data);
    const db = load();
    const b = findOwned(db, d);
    assertChangeable(b);
    const avail = availability(db, { ...d, excludeBookingId: b.id });
    const slot = avail.slots.find((s) => s.time === d.time) ?? fail(409, "slot_unavailable");
    const before = describe(db, b);
    const start = localToDate(d.date, d.time);
    b.serviceId = d.serviceId;
    b.professionalId =
      d.professionalId ?? (slot.professionalIds.includes(b.professionalId) ? b.professionalId : slot.professionalIds[0]!);
    b.start = start.toISOString();
    b.end = new Date(start.getTime() + avail.service.durationMin * 60_000).toISOString();
    b.updatedAt = new Date().toISOString();
    logEvent(db, b.id, "rescheduled", "customer", `${before} → ${describe(db, b)}`);
    save(db);
    return delay(mine(db, b));
  },

  async cancelMyBooking(auth) {
    const a = parse(manageAuth, auth);
    const db = load();
    const b = findOwned(db, a);
    assertChangeable(b);
    b.status = "cancelled";
    b.cancelledAt = b.updatedAt = new Date().toISOString();
    logEvent(db, b.id, "cancelled", "customer", describe(db, b));
    save(db);
    return delay(mine(db, b));
  },

  // ---- Admin: turnos ----
  async adminListBookings(key, query = {}) {
    requireAdmin(key);
    const q = parse(adminBookingQuery, query, "invalid_query");
    const db = load();
    const from = q.from ? localToDate(q.from, "00:00").toISOString() : "";
    const to = q.to ? new Date(localToDate(q.to, "00:00").getTime() + 86_400_000).toISOString() : "";
    const bookings = db.bookings
      .filter(
        (b) =>
          (q.status === "all" || b.status === q.status) &&
          (!q.professionalId || b.professionalId === q.professionalId) &&
          (!from || b.start >= from) &&
          (!to || b.start < to),
      )
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => serialize(db, b));
    return delay({ bookings });
  },

  async adminGetBooking(key, id) {
    requireAdmin(key);
    const db = load();
    const b = findOr404(db.bookings, id);
    const events = db.events
      .filter((e) => e.bookingId === id)
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
      .map(({ bookingId: _b, ...e }) => e);
    return delay({ ...serialize(db, b), events });
  },

  async adminCreateBooking(key, data) {
    requireAdmin(key);
    const d = parse(adminBookingBody, data);
    const db = load();
    const status = d.status ?? "confirmed";
    const { start, end, conflicts } = checkPlacement(db, d);
    if (status === "confirmed" && conflicts.length > 0 && !d.force) fail(409, "conflicts", { conflicts });
    const now = new Date().toISOString();
    const b: DbBooking = {
      id: newId(),
      code: uniqueCode(db),
      status,
      source: "admin",
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      start: start.toISOString(),
      end: end.toISOString(),
      customerName: d.name,
      customerPhone: d.phone,
      customerEmail: d.email,
      notes: d.notes,
      createdAt: now,
      updatedAt: now,
      cancelledAt: status === "cancelled" ? now : null,
    };
    db.bookings.push(b);
    logEvent(db, b.id, "created", "admin", describe(db, b));
    save(db);
    return delay(serialize(db, b));
  },

  async adminUpdateBooking(key, id, data) {
    requireAdmin(key);
    const d = parse(adminBookingBody, data);
    const db = load();
    const b = findOr404(db.bookings, id);
    const status = d.status ?? b.status;
    const { start, end, conflicts } = checkPlacement(db, d, b.id);
    const moved = start.toISOString() !== new Date(b.start).toISOString() || d.professionalId !== b.professionalId || d.serviceId !== b.serviceId;
    const needsCheck = status === "confirmed" && (moved || b.status !== "confirmed");
    if (needsCheck && conflicts.length > 0 && !d.force) fail(409, "conflicts", { conflicts });
    const before = describe(db, b);
    const prevStatus = b.status;
    const now = new Date().toISOString();
    Object.assign(b, {
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      start: start.toISOString(),
      end: end.toISOString(),
      customerName: d.name,
      customerPhone: d.phone,
      customerEmail: d.email,
      notes: d.notes,
      status,
      cancelledAt: status === "cancelled" ? (b.cancelledAt ?? now) : null,
      updatedAt: now,
    });
    const action: BookingEvent["action"] =
      status !== prevStatus ? (status === "cancelled" ? "cancelled" : "reactivated") : moved ? "rescheduled" : "updated";
    logEvent(db, b.id, action, "admin", moved ? `${before} → ${describe(db, b)}` : describe(db, b));
    save(db);
    return delay(serialize(db, b));
  },

  async adminCancelBooking(key, id) {
    requireAdmin(key);
    const db = load();
    const b = findOr404(db.bookings, id);
    if (b.status !== "cancelled") {
      b.status = "cancelled";
      b.cancelledAt = b.updatedAt = new Date().toISOString();
      logEvent(db, b.id, "cancelled", "admin", describe(db, b));
      save(db);
    }
    return delay(serialize(db, b));
  },

  async adminDeleteBooking(key, id) {
    requireAdmin(key);
    const db = load();
    findOr404(db.bookings, id);
    db.bookings = db.bookings.filter((b) => b.id !== id);
    db.events = db.events.filter((e) => e.bookingId !== id);
    save(db);
    return delay(undefined);
  },

  // ---- Admin: servicios ----
  async adminListServices(key) {
    requireAdmin(key);
    const db = load();
    return delay({ services: [...db.services].sort(byOrder).map((s) => adminService(db, s)) });
  },

  async adminCreateService(key, data) {
    requireAdmin(key);
    const d = parse(serviceBody, data);
    const db = load();
    const s: DbService = {
      id: uniqueSlug(d.name, (x) => db.services.some((s) => s.id === x)),
      name: d.name,
      category: d.category,
      description: d.description,
      durationMin: d.durationMin,
      priceFrom: d.priceFrom,
      active: d.active,
      sortOrder: Math.max(-1, ...db.services.map((x) => x.sortOrder)) + 1,
    };
    db.services.push(s);
    setServicePros(db, s.id, d.professionalIds);
    save(db);
    return delay(adminService(db, s));
  },

  async adminUpdateService(key, id, data) {
    requireAdmin(key);
    const d = parse(serviceBody, data);
    const db = load();
    const s = findOr404(db.services, id);
    Object.assign(s, {
      name: d.name,
      category: d.category,
      description: d.description,
      durationMin: d.durationMin,
      priceFrom: d.priceFrom,
      active: d.active,
    });
    setServicePros(db, s.id, d.professionalIds);
    save(db);
    return delay(adminService(db, s));
  },

  async adminDeleteService(key, id) {
    requireAdmin(key);
    const db = load();
    findOr404(db.services, id);
    assertDeletable(db, "serviceId", id);
    db.services = db.services.filter((s) => s.id !== id);
    setServicePros(db, id, []);
    save(db);
    return delay(undefined);
  },

  // ---- Admin: profesionales ----
  async adminListProfessionals(key) {
    requireAdmin(key);
    const db = load();
    return delay({ professionals: [...db.professionals].sort(byOrder).map((p) => adminProfessional(db, p)) });
  },

  async adminCreateProfessional(key, data) {
    requireAdmin(key);
    const d = parse(professionalBody, data);
    const db = load();
    const p: DbProfessional = {
      id: uniqueSlug(d.name, (x) => db.professionals.some((p) => p.id === x), "pro-"),
      name: d.name,
      specialty: d.specialty,
      active: d.active,
      sortOrder: Math.max(-1, ...db.professionals.map((x) => x.sortOrder)) + 1,
      serviceIds: (d.serviceIds ?? []).filter((id) => db.services.some((s) => s.id === id)),
    };
    db.professionals.push(p);
    save(db);
    return delay(adminProfessional(db, p));
  },

  async adminUpdateProfessional(key, id, data) {
    requireAdmin(key);
    const d = parse(professionalBody, data);
    const db = load();
    const p = findOr404(db.professionals, id);
    Object.assign(p, { name: d.name, specialty: d.specialty, active: d.active });
    if (d.serviceIds) p.serviceIds = d.serviceIds.filter((sid) => db.services.some((s) => s.id === sid));
    save(db);
    return delay(adminProfessional(db, p));
  },

  async adminDeleteProfessional(key, id) {
    requireAdmin(key);
    const db = load();
    findOr404(db.professionals, id);
    assertDeletable(db, "professionalId", id);
    db.professionals = db.professionals.filter((p) => p.id !== id);
    save(db);
    return delay(undefined);
  },
};
