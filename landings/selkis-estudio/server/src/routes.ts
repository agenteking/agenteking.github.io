import { Router } from "express";
import { availabilityQuery, bookingBody } from "../../shared/schemas.ts";
import { MAX_ACTIVE_PER_CONTACT, activeForContact, looksLikeBot } from "../../shared/rules.ts";
import { localToDate } from "../../shared/time.ts";
import { admin, cancelBookingHandler, listBookingsHandler, requireAdmin } from "./admin.ts";
import { prisma } from "./db.ts";
import { HttpError, parse } from "./http.ts";
import { manage } from "./manage.ts";
import { clientIp, limits } from "./rate-limit.ts";
import { availability, bookingInclude, describe, lockAgenda, logEvent, publicData, serialize, uniqueCode } from "./store.ts";

export const api = Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Catálogo del sitio: sin cache, así un cambio del panel (precio, alta, baja) se ve al toque.
api.get("/services", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ ...(await publicData()), pricesAreIndicative: true });
});

api.get("/availability", async (req, res) => {
  const q = parse(availabilityQuery, req.query, res, "invalid_query");
  if (!q) return;
  const r = await availability(prisma, q);
  res.set("Cache-Control", "no-store");
  res.json({ date: q.date, serviceId: q.serviceId, durationMin: r.service.durationMin, closed: r.closed, slots: r.slots });
});

api.post("/bookings", async (req, res) => {
  // Freno por IP: cuenta todos los intentos (también los inválidos), así no se llena la agenda con un script.
  const ip = clientIp(req);
  const wait = limits.bookings.blockedFor(ip);
  if (wait) {
    res.set("Retry-After", String(wait));
    throw new HttpError(429, "too_many_requests");
  }
  limits.bookings.hit(ip);
  const d = parse(bookingBody, req.body, res);
  if (!d) return;
  // Honeypot + tiempo mínimo de llenado (sin captcha). No se guarda nada.
  if (looksLikeBot(d)) throw new HttpError(400, "bot_suspected");
  // Chequeo + alta en la misma transacción, bajo el lock de la agenda: dos reservas simultáneas al
  // mismo horario no pueden pasar las dos.
  const booking = await prisma.$transaction(async (tx) => {
    await lockAgenda(tx);
    const avail = await availability(tx, d);
    const slot = avail.slots.find((s) => s.time === d.time);
    if (!slot) throw new HttpError(409, "slot_unavailable");
    // Tope de turnos próximos por celular o email (en la transacción: dos reservas simultáneas no lo saltean).
    const now = new Date();
    const upcoming = await tx.booking.findMany({
      where: { status: "confirmed", start: { gt: now } },
      select: { start: true, status: true, customerPhone: true, customerEmail: true },
    });
    if (activeForContact(upcoming, { phone: d.phone, email: d.email }, now) >= MAX_ACTIVE_PER_CONTACT) {
      throw new HttpError(409, "too_many_bookings");
    }
    const start = localToDate(d.date, d.time);
    const b = await tx.booking.create({
      data: {
        code: await uniqueCode(tx),
        serviceId: d.serviceId,
        professionalId: d.professionalId ?? slot.professionalIds[0]!,
        start,
        end: new Date(start.getTime() + avail.service.durationMin * 60_000),
        customerName: d.name,
        customerPhone: d.phone,
        customerEmail: d.email,
        source: "online",
      },
      include: bookingInclude,
    });
    await logEvent(tx, b.id, "created", "customer", describe(b));
    return b;
  });
  res.status(201).json(serialize(booking));
});

// "Gestionar mi turno" (código + teléfono o email).
api.use("/my-booking", manage);

// Panel admin (header x-admin-key en todo /api/admin).
api.use("/admin", admin);
// Rutas viejas del panel (compatibilidad).
api.get("/bookings", requireAdmin, listBookingsHandler);
api.post("/bookings/:id/cancel", requireAdmin, cancelBookingHandler);
