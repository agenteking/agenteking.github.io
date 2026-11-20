// API Express de punta a punta contra Postgres (Supabase): un schema de test (TEST_DATABASE_URL, …?schema=selkis_test)
// que se borra y se recrea al arrancar, con las migraciones y el seed reales.
import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { MAX_ACTIVE_PER_CONTACT } from "../shared/rules.ts";
import { limits, parseTrustProxy } from "../server/src/rate-limit.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("Falta TEST_DATABASE_URL (postgresql://…?schema=selkis_test): ver README → Tests.");
const testSchema = new URL(testUrl).searchParams.get("schema") ?? "";
// El schema se BORRA entero: nunca contra el de la demo ni public.
if (!/^[a-z0-9_]+_test$/.test(testSchema)) throw new Error(`TEST_DATABASE_URL: el schema tiene que terminar en _test (vino "${testSchema}").`);
process.env.DATABASE_URL = testUrl;
process.env.ADMIN_KEY = "clave-test";
// Como detrás de cloudflared: el test es el "proxy" local y manda X-Forwarded-For, así cada grupo de tests
// tiene su IP y los frenos (por IP) no se pisan entre sí.
process.env.TRUST_PROXY = "loopback";

let base = "";
let close: () => Promise<void> = async () => {};
let hasSsr = false;

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

const ip = "203.0.113.1";

async function call(
  method: string,
  url: string,
  body?: unknown,
  admin: boolean | string = false,
  opts: { ip?: string; headers?: Record<string, string>; base?: string } = {},
) {
  const key = admin === true ? "clave-test" : admin || undefined;
  const res = await fetch((opts.base ?? base) + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": opts.ip ?? ip,
      ...(key ? { "x-admin-key": key } : {}),
      ...opts.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

/** Reserva online como la manda el front (con el tiempo de llenado). */
const booking = (b: Record<string, unknown>) => ({ fillMs: 30_000, website: "", ...b });

/** Borra el schema de test (conexión aparte, sin el ?schema= que pg no entiende); migrate deploy lo recrea. */
async function resetSchema() {
  const u = new URL(testUrl!);
  u.searchParams.delete("schema");
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  const client = new pg.Client({ connectionString: u.toString(), ssl: local ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  } finally {
    await client.end();
  }
}

before(async () => {
  await resetSchema();
  const env = { ...process.env };
  for (const args of [["prisma", "migrate", "deploy"], ["prisma", "db", "seed"]]) {
    try {
      execFileSync("npx", args, { cwd: root, env, encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      const { stdout, stderr } = e as { stdout?: string; stderr?: string };
      throw new Error(`npx ${args.join(" ")} falló:\n${stdout ?? ""}\n${stderr ?? ""}`);
    }
  }
  const { createApp } = await import("../server/src/app.ts");
  const { prisma } = await import("../server/src/db.ts");
  const created = createApp();
  hasSsr = existsSync(path.join(root, "dist/ssr/template.html")) && created.hasWeb;
  const server = created.app.listen(0);
  // Los tests del seed bloquean el event loop varios segundos (execFileSync contra la base remota): sin esto,
  // el server cierra por keep-alive (5 s) una conexión que fetch está por reusar → ECONNRESET.
  server.keepAliveTimeout = 120_000;
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = async () => {
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  };
});

after(async () => {
  await close();
});

describe("reserva y Gestionar mi turno", () => {
  let code = "";

  it("reserva online", async () => {
    const r = await call(
      "POST",
      "/api/bookings",
      booking({
        serviceId: "kapping-gel",
        professionalId: "pro-a",
        date: DAY,
        time: "10:00",
        name: "Ana Test",
        phone: "11 2222-3333",
        email: "ana@test.com",
      }),
    );
    assert.equal(r.status, 201);
    code = r.body.code;
    assert.match(code, /^SLK-[0-9A-F]{6}$/);
  });

  it("valida en castellano", async () => {
    const r = await call("POST", "/api/bookings", booking({ serviceId: "kapping-gel", date: DAY, time: "10:00", name: "A", phone: "1", email: "x" }));
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
    await call(
      "POST",
      "/api/bookings",
      booking({
        serviceId: "semi-manos",
        professionalId: "pro-a",
        date: DAY2,
        time: "15:00",
        name: "Otra",
        phone: "1199998888",
        email: "otra@test.com",
      }),
    );
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

describe("frenos de la reserva online", () => {
  const body = (time: string, extra: Record<string, unknown> = {}) =>
    booking({ serviceId: "semi-manos", professionalId: "pro-b", date: DAY, time, name: "Bea Bot", phone: "11 4444-5555", email: "bea@test.com", ...extra });

  it("honeypot completo → 400 bot_suspected, sin guardar nada", async () => {
    const r = await call("POST", "/api/bookings", body("09:00", { website: "https://spam.example" }), false, { ip: "198.51.100.10" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "bot_suspected");
    const list = await call("GET", `/api/admin/bookings?from=${DAY}&to=${DAY}&professionalId=pro-b`, undefined, true, { ip: "198.51.100.99" });
    assert.equal(list.body.bookings.length, 0);
  });

  it("formulario completado demasiado rápido (o sin el tiempo) → rechazado", async () => {
    const fast = await call("POST", "/api/bookings", body("09:00", { fillMs: 800 }), false, { ip: "198.51.100.10" });
    assert.equal(fast.status, 400);
    assert.equal(fast.body.error, "bot_suspected");
    const { fillMs: _omit, ...noTime } = body("09:00");
    const missing = await call("POST", "/api/bookings", noTime, false, { ip: "198.51.100.10" });
    assert.equal(missing.status, 400);
    assert.ok(missing.body.issues.fillMs);
  });

  it(`tope de ${MAX_ACTIVE_PER_CONTACT} turnos próximos por celular o email`, async () => {
    const opts = { ip: "198.51.100.11" };
    for (const [i, t] of ["09:00", "10:00", "11:00"].entries()) {
      const r = await call("POST", "/api/bookings", body(t, { phone: i ? "+54 9 11 4444 5555" : "1144445555" }), false, opts);
      assert.equal(r.status, 201, t);
    }
    // Mismo celular (otro formato) y otro email: cuenta igual.
    const byPhone = await call("POST", "/api/bookings", body("12:00", { phone: "011 15 4444-5555", email: "otra-bea@test.com" }), false, opts);
    assert.equal(byPhone.status, 409);
    assert.equal(byPhone.body.error, "too_many_bookings");
    assert.match(byPhone.body.message, /Gestionar mi turno/);
    // Mismo email (con mayúsculas) y otro celular: también.
    const byEmail = await call("POST", "/api/bookings", body("12:00", { phone: "11 7777-8888", email: "BEA@test.com" }), false, opts);
    assert.equal(byEmail.status, 409);
    assert.equal(byEmail.body.error, "too_many_bookings");
    // Si cancela uno, puede sacar otro.
    const code = (await call("GET", `/api/admin/bookings?from=${DAY}&to=${DAY}&professionalId=pro-b`, undefined, true, { ip: "198.51.100.99" })).body
      .bookings[0].code;
    assert.equal((await call("POST", "/api/my-booking/cancel", { code, contact: "1144445555" }, false, opts)).status, 200);
    assert.equal((await call("POST", "/api/bookings", body("12:00"), false, opts)).status, 201);
  });

  it(`límite por IP: ${limits.bookings.max} intentos cada 15 min, después 429 con Retry-After`, async () => {
    const opts = { ip: "198.51.100.12" };
    for (let i = 0; i < limits.bookings.max; i++) {
      const r = await call("POST", "/api/bookings", {}, false, opts); // inválidos también cuentan
      assert.equal(r.status, 400);
    }
    const r = await call("POST", "/api/bookings", body("15:00"), false, opts);
    assert.equal(r.status, 429);
    assert.equal(r.body.error, "too_many_requests");
    assert.ok(Number(r.headers.get("retry-after")) > 0);
    // Otra IP sigue pudiendo.
    assert.notEqual((await call("POST", "/api/bookings", {}, false, { ip: "198.51.100.13" })).status, 429);
  });
});

describe("concurrencia (Postgres)", () => {
  it("dos reservas simultáneas al mismo horario: entra una sola", async () => {
    const r = await Promise.all(
      ["Uno", "Dos", "Tres"].map((name, i) =>
        call(
          "POST",
          "/api/bookings",
          booking({ serviceId: "semi-manos", professionalId: "pro-b", date: DAY2, time: "16:00", name: `Carrera ${name}`, phone: `11 6000-000${i}`, email: `carrera${i}@test.com` }),
          false,
          { ip: `198.51.100.5${i}` },
        ),
      ),
    );
    assert.deepEqual(r.map((x) => x.status).sort(), [201, 409, 409]);
    const list = await call("GET", `/api/admin/bookings?from=${DAY2}&to=${DAY2}&professionalId=pro-b`, undefined, true, { ip: "198.51.100.59" });
    assert.equal(list.body.bookings.filter((b: { time: string }) => b.time === "16:00").length, 1);
  });
});

describe("IP real y trust proxy", () => {
  it("parseTrustProxy", () => {
    assert.equal(parseTrustProxy(undefined), false);
    assert.equal(parseTrustProxy(""), false);
    assert.equal(parseTrustProxy("false"), false);
    assert.equal(parseTrustProxy("2"), 2);
    assert.deepEqual(parseTrustProxy("loopback"), ["loopback"]);
    assert.deepEqual(parseTrustProxy("10.0.0.1, 10.0.0.0/8"), ["10.0.0.1", "10.0.0.0/8"]);
  });

  it("sin TRUST_PROXY, X-Forwarded-For y CF-Connecting-IP se ignoran (no se saltea el freno rotando la IP)", async () => {
    const saved = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    const { createApp } = await import("../server/src/app.ts");
    const server = createApp().app.listen(0);
    process.env.TRUST_PROXY = saved;
    await new Promise((r) => server.once("listening", r));
    const direct = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      for (let i = 0; i < limits.admin.max; i++) {
        const r = await call("GET", "/api/admin/services", undefined, "mala", {
          base: direct,
          ip: `192.0.2.${i}`,
          headers: { "CF-Connecting-IP": `192.0.2.${100 + i}` },
        });
        assert.equal(r.status, 401);
      }
      const r = await call("GET", "/api/admin/services", undefined, true, { base: direct, ip: "192.0.2.200" });
      assert.equal(r.status, 429); // todas contaron para la IP del socket (127.0.0.1)
    } finally {
      limits.admin.clear();
      await new Promise((r) => server.close(r));
    }
  });

  it("detrás del proxy de confianza (loopback) se usa CF-Connecting-IP", async () => {
    for (let i = 0; i < limits.admin.max; i++) {
      await call("GET", "/api/admin/services", undefined, "mala", { ip: "192.0.2.50", headers: { "CF-Connecting-IP": "192.0.2.51" } });
    }
    // Bloqueada la del CF-Connecting-IP, no la del X-Forwarded-For.
    assert.equal((await call("GET", "/api/admin/services", undefined, true, { headers: { "CF-Connecting-IP": "192.0.2.51" } })).status, 429);
    assert.equal((await call("GET", "/api/admin/services", undefined, true, { ip: "192.0.2.50" })).status, 200);
  });
});

describe("panel admin", () => {
  it(`clave incorrecta ${limits.admin.max} veces → 429 (aunque después venga la correcta)`, async () => {
    const opts = { ip: "198.51.100.20" };
    for (let i = 0; i < limits.admin.max; i++) {
      const r = await call("GET", "/api/admin/services", undefined, `mala-${i}`, opts);
      assert.equal(r.status, 401);
      assert.equal(r.body.message, "Clave de administración incorrecta.");
    }
    const blocked = await call("GET", "/api/admin/services", undefined, true, opts);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, "too_many_admin_attempts");
    assert.match(blocked.body.message, /15 minutos/);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    // Otra IP entra normal; y un acierto limpia los fallos previos de esa IP.
    const other = { ip: "198.51.100.21" };
    for (let i = 0; i < limits.admin.max - 1; i++) await call("GET", "/api/admin/services", undefined, "mala", other);
    assert.equal((await call("GET", "/api/admin/services", undefined, true, other)).status, 200);
    assert.equal((await call("GET", "/api/admin/services", undefined, "mala", other)).status, 401);
  });

  it("pide la clave en todos los endpoints", async () => {
    for (const [m, u] of [
      ["GET", "/api/admin/bookings"],
      ["GET", "/api/admin/services"],
      ["POST", "/api/admin/professionals"],
      ["DELETE", "/api/admin/services/kapping-gel"],
      ["GET", "/api/bookings"],
    ] as const) {
      const r = await call(m, u, m === "GET" || m === "DELETE" ? undefined : {}, false, { ip: "198.51.100.30" });
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

  it("el HTML del landing (SSR) trae canonical y JSON-LD con los datos vivos", async (t) => {
    if (!hasSsr) return t.skip("sin dist/ssr: corré npm run build");
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /<link rel="canonical" href="http:\/\/localhost:\d+\/" \/>/);
    const m = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.ok(m, "falta el JSON-LD");
    const graph = JSON.parse(m[1]!)["@graph"];
    const biz = graph.find((n: { "@type": unknown }) => Array.isArray(n["@type"]) && n["@type"].includes("BeautySalon"));
    const kapping = biz.hasOfferCatalog.itemListElement.find((o: { itemOffered: { name: string } }) => o.itemOffered.name === "Kapping gel");
    assert.equal(kapping.price, 26500); // el precio que se cambió desde el panel
    assert.ok(!biz.hasOfferCatalog.itemListElement.some((o: { itemOffered: { name: string } }) => o.itemOffered.name.startsWith("Láser")));
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

describe("Edge Function (API sola, como en Supabase)", () => {
  let edge = "";
  let stop: () => Promise<void> = async () => {};
  const gh = "https://agenteking.github.io";

  before(async () => {
    const { createEdgeApp } = await import("../server/src/edge.ts");
    const server = createEdgeApp({}).listen(0);
    await new Promise((r) => server.once("listening", r));
    edge = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    stop = () => new Promise((r) => server.close(() => r()));
  });
  after(async () => {
    limits.admin.clear();
    await stop();
  });

  it("responde con el prefijo de la función (/selkis/api) y sin él (/api)", async () => {
    for (const u of ["/selkis/api/services", "/api/services"]) {
      const r = await call("GET", u, undefined, false, { base: edge });
      assert.equal(r.status, 200, u);
      assert.ok(r.body.services.length > 0);
    }
    assert.equal((await call("GET", "/selkis/api/nada", undefined, false, { base: edge })).status, 404);
    assert.equal((await call("GET", "/selkis/", undefined, false, { base: edge })).status, 404);
  });

  it("CORS: preflight de GitHub Pages con x-admin-key; otro origen no recibe permiso", async () => {
    const pre = await fetch(`${edge}/selkis/api/admin/bookings/x`, {
      method: "OPTIONS",
      headers: { Origin: gh, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,x-admin-key" },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), gh);
    assert.match(pre.headers.get("access-control-allow-headers") ?? "", /x-admin-key/i);
    for (const m of ["GET", "POST", "PUT", "DELETE"]) assert.match(pre.headers.get("access-control-allow-methods") ?? "", new RegExp(m));
    const get = await call("GET", "/selkis/api/services", undefined, false, { base: edge, headers: { Origin: gh } });
    assert.equal(get.headers.get("access-control-allow-origin"), gh);
    assert.match(get.headers.get("vary") ?? "", /Origin/);
    const dev = await call("GET", "/selkis/api/health", undefined, false, { base: edge, headers: { Origin: "http://localhost:5173" } });
    assert.equal(dev.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const evil = await fetch(`${edge}/selkis/api/services`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    assert.equal(evil.headers.get("access-control-allow-headers"), null);
  });

  it("la IP de los frenos sale de CF-Connecting-IP (la pone el gateway de Supabase)", async () => {
    const opts = (cf: string, i = 0) => ({ base: edge, ip: `10.9.9.${i}`, headers: { "CF-Connecting-IP": cf } });
    for (let i = 0; i < limits.admin.max; i++) {
      assert.equal((await call("GET", "/selkis/api/admin/services", undefined, "mala", opts("192.0.2.77", i))).status, 401);
    }
    assert.equal((await call("GET", "/selkis/api/admin/services", undefined, true, opts("192.0.2.77", 99))).status, 429);
    assert.equal((await call("GET", "/selkis/api/admin/services", undefined, true, opts("192.0.2.78"))).status, 200);
  });
});

describe("seed", () => {
  const run = (...args: string[]) =>
    execFileSync("npx", ["tsx", "prisma/seed.ts", ...args], { cwd: root, env: { ...process.env }, encoding: "utf8" });
  const opts = { ip: "198.51.100.40" };

  it("re-seedear no pisa lo editado desde el panel (precio, inactiva) ni toca turnos", async () => {
    const before = await call("GET", "/api/admin/bookings", undefined, true, opts);
    await call("PUT", "/api/admin/services/perfilado-cejas", {
      name: "Perfilado premium", category: "Cejas & pestañas", description: "", durationMin: 45, priceFrom: 15500, active: true,
    }, true, opts);
    const out = run();
    assert.match(out, /agregados 0 servicios, 0 profesionales y 0 días/);
    const services = (await call("GET", "/api/admin/services", undefined, true, opts)).body.services;
    const cejas = services.find((x: { id: string }) => x.id === "perfilado-cejas");
    assert.equal(cejas.priceFrom, 15500);
    assert.equal(cejas.name, "Perfilado premium");
    assert.equal(cejas.durationMin, 45);
    assert.equal(services.find((x: { id: string }) => x.id === "kapping-gel").priceFrom, 26500);
    const pros = (await call("GET", "/api/admin/professionals", undefined, true, opts)).body.professionals;
    assert.equal(pros.find((x: { id: string }) => x.id === "pro-c").active, false);
    const after = await call("GET", "/api/admin/bookings", undefined, true, opts);
    assert.equal(after.body.bookings.length, before.body.bookings.length);
  });

  it("agrega solo lo que falta", async () => {
    const del = await call("DELETE", "/api/admin/services/laser-zona-chica", undefined, true, opts);
    assert.equal(del.status, 204);
    assert.match(run(), /agregados 1 servicios/);
    const services = (await call("GET", "/api/admin/services", undefined, true, opts)).body.services;
    assert.equal(services.find((x: { id: string }) => x.id === "laser-zona-chica").priceFrom, 15000);
  });

  it("--reset borra todo y vuelve al seed", async () => {
    assert.match(run("--reset"), /--reset: borrados \d+ turnos/);
    const services = (await call("GET", "/api/admin/services", undefined, true, opts)).body.services;
    assert.equal(services.find((x: { id: string }) => x.id === "kapping-gel").priceFrom, 24000);
    assert.equal((await call("GET", "/api/admin/bookings", undefined, true, opts)).body.bookings.length, 0);
    const site = await call("GET", "/api/services", undefined, false, opts);
    assert.ok(site.body.professionals.some((x: { id: string }) => x.id === "pro-c"));
  });
});
