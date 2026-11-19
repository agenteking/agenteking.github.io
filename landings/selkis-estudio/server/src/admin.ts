// Panel admin: ABM de turnos, servicios y profesionales. Todo /api/admin pide el header x-admin-key.
import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { placementConflicts, uniqueSlug } from "../../shared/rules.js";
import { adminBookingBody, adminBookingQuery, professionalBody, serviceBody } from "../../shared/schemas.js";
import { localToDate } from "../../shared/time.js";
import type { AdminProfessional, AdminService, BookingEvent, BookingWithHistory } from "../../shared/types.js";
import { prisma } from "./db.js";
import { HttpError, parse, sendError } from "./http.js";
import { bookingInclude, bumpCatalog, busyFor, describe, getHours, logEvent, serialize, uniqueCode, type Db } from "./store.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = Buffer.from(process.env.ADMIN_KEY ?? "cambiame");
  const given = Buffer.from(String(req.get("x-admin-key") ?? ""));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    sendError(res, 401, "unauthorized");
    return;
  }
  res.set("Cache-Control", "no-store");
  next();
}

export const admin = Router();
admin.use(requireAdmin);

const idParam = (req: Request) => String(req.params.id);

// ---------- Turnos ----------
export async function listBookingsHandler(req: Request, res: Response) {
  const q = parse(adminBookingQuery, req.query, res, "invalid_query");
  if (!q) return;
  const start: { gte?: Date; lt?: Date } = {};
  if (q.from) start.gte = localToDate(q.from, "00:00");
  if (q.to) start.lt = new Date(localToDate(q.to, "00:00").getTime() + 86_400_000);
  const bookings = await prisma.booking.findMany({
    where: {
      ...(q.status === "all" ? {} : { status: q.status }),
      ...(q.professionalId ? { professionalId: q.professionalId } : {}),
      ...(q.from || q.to ? { start } : {}),
    },
    orderBy: { start: "asc" },
    include: bookingInclude,
  });
  res.json({ bookings: bookings.map(serialize) });
}

export async function cancelBookingHandler(req: Request, res: Response) {
  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: idParam(req) }, include: bookingInclude });
    if (!b) throw new HttpError(404, "not_found");
    if (b.status === "cancelled") return b;
    const u = await tx.booking.update({
      where: { id: b.id },
      data: { status: "cancelled", cancelledAt: new Date() },
      include: bookingInclude,
    });
    await logEvent(tx, b.id, "cancelled", "admin", describe(b));
    return u;
  });
  res.json(serialize(updated));
}

admin.get("/bookings", listBookingsHandler);

admin.get("/bookings/:id", async (req, res) => {
  const b = await prisma.booking.findUnique({
    where: { id: idParam(req) },
    include: { ...bookingInclude, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!b) throw new HttpError(404, "not_found");
  const out: BookingWithHistory = {
    ...serialize(b),
    events: b.events.map((e) => ({
      id: e.id,
      action: e.action as BookingEvent["action"],
      actor: e.actor as BookingEvent["actor"],
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  };
  res.json(out);
});

/** Valida servicio/profesional y arma los conflictos de agenda de una carga manual. */
async function checkPlacement(
  tx: Db,
  d: { serviceId: string; professionalId: string; date: string; time: string },
  excludeBookingId?: string,
) {
  const service = await tx.service.findUnique({ where: { id: d.serviceId } });
  if (!service) throw new HttpError(404, "service_not_found");
  const pro = await tx.professional.findUnique({
    where: { id: d.professionalId },
    include: { services: { where: { id: d.serviceId }, select: { id: true } } },
  });
  if (!pro) throw new HttpError(404, "professional_not_found");
  const start = localToDate(d.date, d.time);
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const conflicts = placementConflicts({
    date: d.date,
    time: d.time,
    durationMin: service.durationMin,
    hours: await getHours(tx),
    service,
    professional: { id: pro.id, name: pro.name, active: pro.active, doesService: pro.services.length > 0 },
    busy: await busyFor(tx, [pro.id], start, end),
    excludeBookingId,
  });
  return { start, end, conflicts };
}

admin.post("/bookings", async (req, res) => {
  const d = parse(adminBookingBody, req.body, res);
  if (!d) return;
  const status = d.status ?? "confirmed";
  const created = await prisma.$transaction(async (tx) => {
    const { start, end, conflicts } = await checkPlacement(tx, d);
    if (status === "confirmed" && conflicts.length > 0 && !d.force) throw new HttpError(409, "conflicts", { conflicts });
    const b = await tx.booking.create({
      data: {
        code: await uniqueCode(tx),
        serviceId: d.serviceId,
        professionalId: d.professionalId,
        start,
        end,
        customerName: d.name,
        customerPhone: d.phone,
        customerEmail: d.email,
        notes: d.notes,
        status,
        cancelledAt: status === "cancelled" ? new Date() : null,
        source: "admin",
      },
      include: bookingInclude,
    });
    await logEvent(tx, b.id, "created", "admin", describe(b));
    return b;
  });
  res.status(201).json(serialize(created));
});

admin.put("/bookings/:id", async (req, res) => {
  const d = parse(adminBookingBody, req.body, res);
  if (!d) return;
  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: idParam(req) }, include: bookingInclude });
    if (!b) throw new HttpError(404, "not_found");
    const status = d.status ?? b.status;
    const { start, end, conflicts } = await checkPlacement(tx, d, b.id);
    const moved = start.getTime() !== b.start.getTime() || d.professionalId !== b.professionalId || d.serviceId !== b.serviceId;
    // Solo se avisa si el turno queda confirmado y cambia de lugar (o se reactiva).
    const needsCheck = status === "confirmed" && (moved || b.status !== "confirmed");
    if (needsCheck && conflicts.length > 0 && !d.force) throw new HttpError(409, "conflicts", { conflicts });
    const u = await tx.booking.update({
      where: { id: b.id },
      data: {
        serviceId: d.serviceId,
        professionalId: d.professionalId,
        start,
        end,
        customerName: d.name,
        customerPhone: d.phone,
        customerEmail: d.email,
        notes: d.notes,
        status,
        cancelledAt: status === "cancelled" ? (b.cancelledAt ?? new Date()) : null,
      },
      include: bookingInclude,
    });
    const action: BookingEvent["action"] =
      status !== b.status ? (status === "cancelled" ? "cancelled" : "reactivated") : moved ? "rescheduled" : "updated";
    await logEvent(tx, b.id, action, "admin", moved ? `${describe(b)} → ${describe(u)}` : describe(u));
    return u;
  });
  res.json(serialize(updated));
});

admin.post("/bookings/:id/cancel", cancelBookingHandler);

admin.delete("/bookings/:id", async (req, res) => {
  const b = await prisma.booking.findUnique({ where: { id: idParam(req) }, select: { id: true } });
  if (!b) throw new HttpError(404, "not_found");
  await prisma.booking.delete({ where: { id: b.id } }); // el historial se borra en cascada
  res.status(204).end();
});

// ---------- Conteos de turnos (para bloquear bajas) ----------
async function bookingCounts(field: "serviceId" | "professionalId") {
  const now = new Date();
  const [future, total] = await Promise.all([
    prisma.booking.groupBy({ by: [field], where: { status: "confirmed", start: { gte: now } }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: [field], _count: { _all: true } }),
  ]);
  const toMap = (rows: typeof future) => new Map(rows.map((r) => [r[field], r._count._all]));
  return { future: toMap(future), total: toMap(total) };
}

async function assertDeletable(where: { serviceId: string } | { professionalId: string }) {
  const futureBookings = await prisma.booking.count({ where: { ...where, status: "confirmed", start: { gte: new Date() } } });
  if (futureBookings > 0) throw new HttpError(409, "has_future_bookings", { futureBookings });
  const total = await prisma.booking.count({ where });
  if (total > 0) throw new HttpError(409, "has_history", { totalBookings: total });
}

// ---------- Servicios ----------
async function listServices(): Promise<AdminService[]> {
  const [services, counts] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { professionals: { select: { id: true } } },
    }),
    bookingCounts("serviceId"),
  ]);
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    durationMin: s.durationMin,
    priceFrom: s.priceFrom,
    active: s.active,
    sortOrder: s.sortOrder,
    professionalIds: s.professionals.map((p) => p.id),
    futureBookings: counts.future.get(s.id) ?? 0,
    totalBookings: counts.total.get(s.id) ?? 0,
  }));
}

const findService = async (id: string) => (await listServices()).find((s) => s.id === id);

/** Se quedan solo los ids que existen. */
async function existingIds(model: "service" | "professional", ids: string[] | undefined) {
  if (!ids) return undefined;
  const rows =
    model === "service"
      ? await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true } })
      : await prisma.professional.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((r) => ({ id: r.id }));
}

admin.get("/services", async (_req, res) => {
  res.json({ services: await listServices() });
});

admin.post("/services", async (req, res) => {
  const d = parse(serviceBody, req.body, res);
  if (!d) return;
  const all = await prisma.service.findMany({ select: { id: true, sortOrder: true } });
  const taken = new Set(all.map((s) => s.id));
  const id = uniqueSlug(d.name, (x) => taken.has(x));
  const links = await existingIds("professional", d.professionalIds);
  await prisma.service.create({
    data: {
      id,
      name: d.name,
      category: d.category,
      description: d.description,
      durationMin: d.durationMin,
      priceFrom: d.priceFrom,
      active: d.active,
      sortOrder: Math.max(-1, ...all.map((s) => s.sortOrder)) + 1,
      ...(links ? { professionals: { connect: links } } : {}),
    },
  });
  bumpCatalog();
  res.status(201).json(await findService(id));
});

admin.put("/services/:id", async (req, res) => {
  const d = parse(serviceBody, req.body, res);
  if (!d) return;
  const id = idParam(req);
  if (!(await prisma.service.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "not_found");
  const links = await existingIds("professional", d.professionalIds);
  await prisma.service.update({
    where: { id },
    data: {
      name: d.name,
      category: d.category,
      description: d.description,
      durationMin: d.durationMin,
      priceFrom: d.priceFrom,
      active: d.active,
      ...(links ? { professionals: { set: links } } : {}),
    },
  });
  bumpCatalog();
  res.json(await findService(id));
});

admin.delete("/services/:id", async (req, res) => {
  const id = idParam(req);
  if (!(await prisma.service.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "not_found");
  await assertDeletable({ serviceId: id });
  await prisma.service.delete({ where: { id } });
  bumpCatalog();
  res.status(204).end();
});

// ---------- Profesionales ----------
async function listProfessionals(): Promise<AdminProfessional[]> {
  const [pros, counts] = await Promise.all([
    prisma.professional.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { services: { select: { id: true } } },
    }),
    bookingCounts("professionalId"),
  ]);
  return pros.map((p) => ({
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    active: p.active,
    sortOrder: p.sortOrder,
    serviceIds: p.services.map((s) => s.id),
    futureBookings: counts.future.get(p.id) ?? 0,
    totalBookings: counts.total.get(p.id) ?? 0,
  }));
}

const findProfessional = async (id: string) => (await listProfessionals()).find((p) => p.id === id);

admin.get("/professionals", async (_req, res) => {
  res.json({ professionals: await listProfessionals() });
});

admin.post("/professionals", async (req, res) => {
  const d = parse(professionalBody, req.body, res);
  if (!d) return;
  const all = await prisma.professional.findMany({ select: { id: true, sortOrder: true } });
  const taken = new Set(all.map((p) => p.id));
  const id = uniqueSlug(d.name, (x) => taken.has(x), "pro-");
  const links = await existingIds("service", d.serviceIds);
  await prisma.professional.create({
    data: {
      id,
      name: d.name,
      specialty: d.specialty,
      active: d.active,
      sortOrder: Math.max(-1, ...all.map((p) => p.sortOrder)) + 1,
      ...(links ? { services: { connect: links } } : {}),
    },
  });
  bumpCatalog();
  res.status(201).json(await findProfessional(id));
});

admin.put("/professionals/:id", async (req, res) => {
  const d = parse(professionalBody, req.body, res);
  if (!d) return;
  const id = idParam(req);
  if (!(await prisma.professional.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "not_found");
  const links = await existingIds("service", d.serviceIds);
  await prisma.professional.update({
    where: { id },
    data: {
      name: d.name,
      specialty: d.specialty,
      active: d.active,
      ...(links ? { services: { set: links } } : {}),
    },
  });
  bumpCatalog();
  res.json(await findProfessional(id));
});

admin.delete("/professionals/:id", async (req, res) => {
  const id = idParam(req);
  if (!(await prisma.professional.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, "not_found");
  await assertDeletable({ professionalId: id });
  await prisma.professional.delete({ where: { id } });
  bumpCatalog();
  res.status(204).end();
});
