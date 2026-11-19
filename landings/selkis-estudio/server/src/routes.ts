import { Router } from "express";
import { availabilityQuery, bookingBody } from "../../shared/schemas.js";
import { localToDate } from "../../shared/time.js";
import { admin, cancelBookingHandler, listBookingsHandler, requireAdmin } from "./admin.js";
import { prisma } from "./db.js";
import { HttpError, parse } from "./http.js";
import { manage } from "./manage.js";
import { availability, bookingInclude, describe, logEvent, publicData, serialize, uniqueCode } from "./store.js";

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
  const d = parse(bookingBody, req.body, res);
  if (!d) return;
  // Chequeo + alta en la misma transacción: SQLite serializa las escrituras, así que dos
  // reservas simultáneas al mismo horario no pueden pasar las dos.
  const booking = await prisma.$transaction(async (tx) => {
    const avail = await availability(tx, d);
    const slot = avail.slots.find((s) => s.time === d.time);
    if (!slot) throw new HttpError(409, "slot_unavailable");
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
