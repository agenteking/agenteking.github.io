import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getAvailability } from "./availability.js";
import { prisma } from "./db.js";
import { localToDate, toLocalDate, toLocalHHMM } from "./time.js";

export const api = Router();

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

api.get("/services", async (_req, res) => {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { professionals: { select: { id: true, name: true, specialty: true } } },
  });
  const hours = await prisma.businessHour.findMany({ orderBy: { weekday: "asc" } });
  res.set("Cache-Control", "public, max-age=60");
  res.json({ services, hours, pricesAreIndicative: true });
});

const availabilityQuery = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(dateRe, "Formato YYYY-MM-DD"),
  professionalId: z.string().min(1).optional(),
});

api.get("/availability", async (req, res) => {
  const parsed = availabilityQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", issues: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { serviceId, date, professionalId } = parsed.data;
  const result = await getAvailability(serviceId, date, professionalId);
  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json({ date, serviceId, durationMin: result.service.durationMin, closed: result.closed, slots: result.slots });
});

const bookingBody = z.object({
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).optional(),
  date: z.string().regex(dateRe),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2, "Ingresá tu nombre").max(80),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{8,15}$/, "Teléfono inválido")),
  email: z.email("Email inválido").max(120),
});

const newCode = () => `SLK-${randomBytes(3).toString("hex").toUpperCase()}`;

function serialize(b: {
  id: string;
  code: string;
  start: Date;
  end: Date;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: Date;
  service: { id: string; name: string; durationMin: number };
  professional: { id: string; name: string };
}) {
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    date: toLocalDate(b.start),
    time: toLocalHHMM(b.start),
    endTime: toLocalHHMM(b.end),
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    service: b.service,
    professional: b.professional,
    customer: { name: b.customerName, phone: b.customerPhone, email: b.customerEmail },
    createdAt: b.createdAt.toISOString(),
  };
}

const bookingInclude = {
  service: { select: { id: true, name: true, durationMin: true } },
  professional: { select: { id: true, name: true } },
} as const;

api.post("/bookings", async (req, res) => {
  const parsed = bookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", issues: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const d = parsed.data;
  // Chequeo + alta en la misma transacción: SQLite serializa las escrituras, así que dos
  // reservas simultáneas al mismo horario no pueden pasar las dos.
  const result = await prisma.$transaction(async (tx) => {
    const avail = await getAvailability(d.serviceId, d.date, d.professionalId, tx);
    if ("error" in avail) return { status: 404, body: { error: avail.error } };
    const slot = avail.slots.find((s) => s.time === d.time);
    if (!slot) return { status: 409, body: { error: "slot_unavailable", message: "Ese horario ya no está disponible." } };
    const professionalId = d.professionalId ?? slot.professionalIds[0]!;
    const start = localToDate(d.date, d.time);
    const booking = await tx.booking.create({
      data: {
        code: newCode(),
        serviceId: d.serviceId,
        professionalId,
        start,
        end: new Date(start.getTime() + avail.service.durationMin * 60_000),
        customerName: d.name,
        customerPhone: d.phone,
        customerEmail: d.email,
      },
      include: bookingInclude,
    });
    return { status: 201, body: serialize(booking) };
  });
  res.status(result.status).json(result.body);
});

// ---- Panel admin (header x-admin-key) ----
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = Buffer.from(process.env.ADMIN_KEY ?? "selkis-demo-2026");
  const given = Buffer.from(String(req.get("x-admin-key") ?? ""));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

const listQuery = z.object({
  from: z.string().regex(dateRe).optional(),
  status: z.enum(["confirmed", "cancelled", "all"]).default("all"),
});

api.get("/bookings", requireAdmin, async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query" });
    return;
  }
  const { from, status } = parsed.data;
  const bookings = await prisma.booking.findMany({
    where: {
      ...(status === "all" ? {} : { status }),
      ...(from ? { start: { gte: localToDate(from, "00:00") } } : {}),
    },
    orderBy: { start: "asc" },
    include: bookingInclude,
  });
  res.set("Cache-Control", "no-store");
  res.json({ bookings: bookings.map(serialize) });
});

api.post("/bookings/:id/cancel", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const booking = await prisma.booking.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: existing.cancelledAt ?? new Date() },
    include: bookingInclude,
  });
  res.json(serialize(booking));
});
