// "Gestionar mi turno": la clienta se identifica con el código de reserva + el teléfono o el email
// con el que reservó. Todo va por POST/PUT con body JSON (el contacto no queda en URLs ni logs).
import { Router, type Request } from "express";
import { canCustomerChange, contactMatches, normalizeCode } from "../../shared/rules.ts";
import { manageAuth, manageAvailability, manageChange, type ManageAuth } from "../../shared/schemas.ts";
import { localToDate } from "../../shared/time.ts";
import type { MyBooking } from "../../shared/types.ts";
import { prisma } from "./db.ts";
import { HttpError, parse } from "./http.ts";
import { clientIp, limits } from "./rate-limit.ts";
import { availability, bookingInclude, describe, lockAgenda, logEvent, serialize, type Db } from "./store.ts";

export const manage = Router();

// Freno a la fuerza bruta: hasta 20 identificaciones fallidas por IP cada 15 minutos (rate-limit.ts).
function checkRate(req: Request) {
  if (limits.manage.blockedFor(clientIp(req))) throw new HttpError(429, "too_many_attempts");
}

const recordFail = (req: Request) => limits.manage.hit(clientIp(req));

/** Busca el turno por código y verifica el contacto. Misma respuesta si falla cualquiera de los dos. */
async function findOwned(db: Db, req: Request, auth: Required<ManageAuth>) {
  checkRate(req);
  const b = await db.booking.findUnique({ where: { code: normalizeCode(auth.code) }, include: bookingInclude });
  if (!b || !contactMatches(auth.contact, { phone: b.customerPhone, email: b.customerEmail })) {
    recordFail(req);
    throw new HttpError(404, "booking_not_found");
  }
  return b;
}

type Row = Awaited<ReturnType<typeof findOwned>>;
const mine = (b: Row): MyBooking => ({
  ...serialize(b),
  canChange: b.status === "confirmed" && canCustomerChange(b.start),
});

function assertChangeable(b: Row) {
  if (b.status !== "confirmed") throw new HttpError(409, "booking_cancelled");
  if (!canCustomerChange(b.start)) throw new HttpError(409, "too_late");
}

manage.post("/", async (req, res) => {
  const auth = parse(manageAuth, req.body, res);
  if (!auth) return;
  res.set("Cache-Control", "no-store");
  res.json(mine(await findOwned(prisma, req, auth)));
});

/** Horarios libres para el cambio: mismas reglas que reservar, sin contar el turno propio. */
manage.post("/availability", async (req, res) => {
  const d = parse(manageAvailability, req.body, res);
  if (!d) return;
  const b = await findOwned(prisma, req, d);
  const r = await availability(prisma, { ...d, excludeBookingId: b.id });
  res.set("Cache-Control", "no-store");
  res.json({ date: d.date, serviceId: d.serviceId, durationMin: r.service.durationMin, closed: r.closed, slots: r.slots });
});

manage.put("/", async (req, res) => {
  const d = parse(manageChange, req.body, res);
  if (!d) return;
  const updated = await prisma.$transaction(async (tx) => {
    await lockAgenda(tx);
    const b = await findOwned(tx, req, d);
    assertChangeable(b);
    const avail = await availability(tx, { ...d, excludeBookingId: b.id });
    const slot = avail.slots.find((s) => s.time === d.time);
    if (!slot) throw new HttpError(409, "slot_unavailable");
    // Sin preferencia: si su profesional actual está libre, se queda con ella.
    const professionalId =
      d.professionalId ?? (slot.professionalIds.includes(b.professionalId) ? b.professionalId : slot.professionalIds[0]!);
    const start = localToDate(d.date, d.time);
    const u = await tx.booking.update({
      where: { id: b.id },
      data: {
        serviceId: d.serviceId,
        professionalId,
        start,
        end: new Date(start.getTime() + avail.service.durationMin * 60_000),
      },
      include: bookingInclude,
    });
    await logEvent(tx, b.id, "rescheduled", "customer", `${describe(b)} → ${describe(u)}`);
    return u;
  });
  res.json(mine(updated));
});

manage.post("/cancel", async (req, res) => {
  const auth = parse(manageAuth, req.body, res);
  if (!auth) return;
  const updated = await prisma.$transaction(async (tx) => {
    const b = await findOwned(tx, req, auth);
    assertChangeable(b);
    const u = await tx.booking.update({
      where: { id: b.id },
      data: { status: "cancelled", cancelledAt: new Date() },
      include: bookingInclude,
    });
    await logEvent(tx, b.id, "cancelled", "customer", describe(b));
    return u;
  });
  res.json(mine(updated));
});
