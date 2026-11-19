// API Express de punta a punta contra una base SQLite temporal (migraciones + seed reales).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "selkis-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.ADMIN_KEY = "clave-test";

let base = "";
let close: () => Promise<void> = async () => {};

/** Próximo martes a viernes, al menos 2 días adelante (YYYY-MM-DD, hora BA). */
function nextWeekday(skip = 0) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  let found = 0;
  for (let i = 2; ; i++) {
    const d = fmt.format(new Date(Date.now() + i * 86_400_000));
    const wd = new Date(`${d}T12:00:00-03:00`).getUTCDay();
    if (wd >= 2 && wd <= 5 && found++ === skip) return d;
  }
}
const DAY = nextWeekday();
const DAY2 = nextWeekday(1);

async function call(method: string, url: string, body?: unknown, admin = false) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(admin ? { "x-admin-key": "clave-test" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  const env = { ...process.env };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: root, env, stdio: "ignore" });
  execFileSync("npx", ["prisma", "db", "seed"], { cwd: root, env, stdio: "ignore" });
  const { createApp } = await import("../server/src/app.js");
  const { prisma } = await import("../server/src/db.js");
  const server = createApp().app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = async () => {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  };
});

after(async () => {
  await close();
  rmSync(dir, { recursive: true, force: true });
});

describe("reserva y Gestionar mi turno", () => {
  let code = "";

  it("reserva online", async () => {
    const r = await call("POST", "/api/bookings", {
      serviceId: "kapping-gel",
      professionalId: "pro-a",
      date: DAY,
      time: "10:00",
      name: "Ana Test",
      phone: "11 2222-3333",
      email: "ana@test.com",
    });
    assert.equal(r.status, 201);
    code = r.body.code;
    assert.match(code, /^SLK-[0-9A-F]{6}$/);
  });

  it("valida en castellano", async () => {
    const r = await call("POST", "/api/bookings", { serviceId: "kapping-gel", date: DAY, time: "10:00", name: "A", phone: "1", email: "x" });
    assert.equal(r.status, 400);
    assert.equal(r.body.issues.phone[0], "Teléfono inválido");
    assert.equal(r.body.issues.email[0], "Email inválido");
  });

  it("identifica con código + teléfono o email; si no coincide, 404", async () => {
    assert.equal((await call("POST", "/api/my-booking", { code: code.toLowerCase(), contact: "+54 9 11 2222 3333" })).status, 200);
    const ok = await call("POST", "/api/my-booking", { code, contact: "ANA@test.com" });
    assert.equal(ok.body.canChange, true);
    const bad = await call("POST", "/api/my-booking", { code, contact: "otra@test.com" });
    assert.equal(bad.status, 404);
    assert.equal(bad.body.error, "booking_not_found");
  });

  it("al cambiar, su propio horario cuenta como libre", async () => {
    const pub = await call("GET", `/api/availability?serviceId=kapping-gel&date=${DAY}&professionalId=pro-a`);
    assert.ok(!pub.body.slots.some((s: { time: string }) => s.time === "10:00"));
    const mine = await call("POST", "/api/my-booking/availability", {
      code,
      contact: "ana@test.com",
      serviceId: "kapping-gel",
      date: DAY,
      professionalId: "pro-a",
    });
    assert.ok(mine.body.slots.some((s: { time: string }) => s.time === "10:00"));
  });

  it("cambia servicio, día y horario (y no pisa otro turno)", async () => {
    // Otro turno de pro-a el DAY2 a las 15:00.
    await call("POST", "/api/bookings", {
      serviceId: "semi-manos",
      professionalId: "pro-a",
      date: DAY2,
      time: "15:00",
      name: "Otra",
      phone: "1199998888",
      email: "otra@test.com",
    });
    const clash = await call("PUT", "/api/my-booking", {
      code,
      contact: "1122223333",
      serviceId: "esculpidas",
      professionalId: "pro-a",
      date: DAY2,
      time: "14:00",
    });
    assert.equal(clash.status, 409);
    assert.equal(clash.body.error, "slot_unavailable");
    const r = await call("PUT", "/api/my-booking", {
      code,
      contact: "1122223333",
      serviceId: "esculpidas",
      date: DAY2,
      time: "11:00",
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.service.id, "esculpidas");
    assert.equal(r.body.date, DAY2);
    assert.equal(r.body.time, "11:00");
    assert.equal(r.body.professional.id, "pro-a"); // sin preferencia: se queda con la misma si está libre
  });

  it("cancela y después no deja cambiar", async () => {
    const r = await call("POST", "/api/my-booking/cancel", { code, contact: "ana@test.com" });
    assert.equal(r.body.status, "cancelled");
    const again = await call("POST", "/api/my-booking/cancel", { code, contact: "ana@test.com" });
    assert.equal(again.status, 409);
    assert.equal(again.body.error, "booking_cancelled");
  });
});

describe("panel admin", () => {
  it("pide la clave en todos los endpoints", async () => {
    for (const [m, u] of [
      ["GET", "/api/admin/bookings"],
      ["GET", "/api/admin/services"],
      ["POST", "/api/admin/professionals"],
      ["DELETE", "/api/admin/services/kapping-gel"],
      ["GET", "/api/bookings"],
    ] as const) {
      const r = await call(m, u, m === "GET" || m === "DELETE" ? undefined : {});
      assert.equal(r.status, 401, `${m} ${u}`);
    }
  });

  let proId = "";
  let serviceId = "";

  it("alta de profesional y servicio → aparecen en el sitio con su precio", async () => {
    const p = await call("POST", "/api/admin/professionals", { name: "Sofía Test", specialty: "Masajes", serviceIds: [] }, true);
    assert.equal(p.status, 201);
    proId = p.body.id;
    assert.equal(proId, "pro-sofia-test");
    const s = await call(
      "POST",
      "/api/admin/services",
      { name: "Masaje relajante", category: "Spa", description: "", durationMin: 45, priceFrom: 30000, professionalIds: [proId] },
      true,
    );
    assert.equal(s.status, 201);
    serviceId = s.body.id;
    const site = await call("GET", "/api/services");
    const svc = site.body.services.find((x: { id: string }) => x.id === serviceId);
    assert.equal(svc.priceFrom, 30000);
    assert.deepEqual(svc.professionals.map((x: { id: string }) => x.id), [proId]);
    assert.ok(site.body.professionals.some((x: { id: string }) => x.id === proId));
  });

  it("valida servicio con mensajes claros", async () => {
    const r = await call("POST", "/api/admin/services", { name: "X", category: "", durationMin: 50, priceFrom: -1 }, true);
    assert.equal(r.status, 400);
    assert.equal(r.body.issues.durationMin[0], "Usá múltiplos de 15 minutos");
    assert.equal(r.body.issues.priceFrom[0], "El precio no puede ser negativo");
  });

  it("cambio de precio y baja lógica se ven en el sitio", async () => {
    await call("PUT", "/api/admin/services/kapping-gel", {
      name: "Kapping gel",
      category: "Uñas",
      description: "x",
      durationMin: 90,
      priceFrom: 26500,
      active: true,
    }, true);
    let site = await call("GET", "/api/services");
    assert.equal(site.body.services.find((x: { id: string }) => x.id === "kapping-gel").priceFrom, 26500);
    await call("PUT", "/api/admin/professionals/pro-c", { name: "Profesional C", specialty: "", active: false }, true);
    site = await call("GET", "/api/services");
    assert.ok(!site.body.professionals.some((x: { id: string }) => x.id === "pro-c"));
    // pro-c era la única de láser: esos servicios dejan de ofrecerse.
    assert.ok(!site.body.services.some((x: { id: string }) => x.id === "laser-piernas"));
    const av = await call("GET", `/api/availability?serviceId=laser-piernas&date=${DAY}`);
    assert.equal(av.status, 404);
  });

  let bookingId = "";

  it("turno manual: superposición pide confirmar (force)", async () => {
    const body = { serviceId, professionalId: proId, date: DAY, time: "12:00", name: "Walk-in", phone: "", email: "" };
    const a = await call("POST", "/api/admin/bookings", body, true);
    assert.equal(a.status, 201);
    assert.equal(a.body.source, "admin");
    bookingId = a.body.id;
    const b = await call("POST", "/api/admin/bookings", { ...body, time: "12:30", name: "Pisada" }, true);
    assert.equal(b.status, 409);
    assert.equal(b.body.conflicts[0].type, "overlap");
    const forced = await call("POST", "/api/admin/bookings", { ...body, time: "12:30", name: "Pisada", force: true }, true);
    assert.equal(forced.status, 201);
    await call("DELETE", `/api/admin/bookings/${forced.body.id}`, undefined, true);
  });

  it("turno manual: puede ignorar la anticipación mínima pero avisa fuera de horario", async () => {
    const r = await call(
      "POST",
      "/api/admin/bookings",
      { serviceId, professionalId: proId, date: DAY, time: "20:00", name: "Tarde" },
      true,
    );
    assert.equal(r.status, 409);
    assert.equal(r.body.conflicts[0].type, "outside_hours");
  });

  it("editar, filtrar e historial", async () => {
    const r = await call(
      "PUT",
      `/api/admin/bookings/${bookingId}`,
      { serviceId, professionalId: proId, date: DAY2, time: "16:00", name: "Walk-in Editada", phone: "1155554444", email: "" },
      true,
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.time, "16:00");
    const list = await call("GET", `/api/admin/bookings?from=${DAY2}&to=${DAY2}&professionalId=${proId}`, undefined, true);
    assert.deepEqual(list.body.bookings.map((b: { id: string }) => b.id), [bookingId]);
    const detail = await call("GET", `/api/admin/bookings/${bookingId}`, undefined, true);
    assert.deepEqual(detail.body.events.map((e: { action: string }) => e.action), ["created", "rescheduled"]);
  });

  it("no deja borrar servicio/profesional con turnos; sí después de borrar el turno", async () => {
    const s = await call("DELETE", `/api/admin/services/${serviceId}`, undefined, true);
    assert.equal(s.status, 409);
    assert.equal(s.body.error, "has_future_bookings");
    const p = await call("DELETE", `/api/admin/professionals/${proId}`, undefined, true);
    assert.equal(p.status, 409);
    assert.equal((await call("DELETE", `/api/admin/bookings/${bookingId}`, undefined, true)).status, 204);
    assert.equal((await call("DELETE", `/api/admin/services/${serviceId}`, undefined, true)).status, 204);
    assert.equal((await call("DELETE", `/api/admin/professionals/${proId}`, undefined, true)).status, 204);
    const site = await call("GET", "/api/services");
    assert.ok(!site.body.services.some((x: { id: string }) => x.id === serviceId));
  });

  it("servicio con historial (turno cancelado) tampoco se borra: hay que desactivarlo", async () => {
    const r = await call("DELETE", "/api/admin/services/esculpidas", undefined, true);
    assert.equal(r.status, 409);
    assert.equal(r.body.error, "has_history");
    assert.match(r.body.message, /desactivalo/);
  });
});
