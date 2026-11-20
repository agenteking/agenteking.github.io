// Reglas puras de la agenda (shared/rules.ts): las usan el server y la demo estática.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCustomerChange,
  computeSlots,
  contactMatches,
  normalizeCode,
  placementConflicts,
  uniqueSlug,
  type BusyBooking,
} from "../shared/rules.ts";
import { SEED_HOURS } from "../shared/seed-data.ts";
import { localToDate } from "../shared/time.ts";

// Miércoles 2026-12-02, 09:00–19:00. "Ahora" = el lunes anterior, así la anticipación no molesta.
const DATE = "2026-12-02";
const NOW = localToDate("2026-11-30", "10:00");
const busy = (id: string, pro: string, from: string, to: string): BusyBooking => ({
  id,
  code: `SLK-${id}`,
  professionalId: pro,
  start: localToDate(DATE, from),
  end: localToDate(DATE, to),
});

describe("computeSlots", () => {
  it("arma slots de 30 min dentro del horario del local", () => {
    const r = computeSlots({ date: DATE, durationMin: 60, professionalIds: ["a"], hours: SEED_HOURS, busy: [], now: NOW });
    assert.equal(r.closed, false);
    assert.equal(r.slots[0]?.time, "09:00");
    assert.equal(r.slots.at(-1)?.time, "18:00"); // 18:00 + 60 = 19:00 (cierre)
    assert.equal(r.slots.length, 19);
  });

  it("domingo: cerrado", () => {
    const r = computeSlots({ date: "2026-12-06", durationMin: 60, professionalIds: ["a"], hours: SEED_HOURS, busy: [], now: NOW });
    assert.deepEqual(r, { slots: [], closed: true });
  });

  it("saca los horarios superpuestos, salvo el turno excluido (el propio al cambiarlo)", () => {
    const b = [busy("1", "a", "10:00", "11:30")];
    const base = { date: DATE, durationMin: 60, professionalIds: ["a"], hours: SEED_HOURS, busy: b, now: NOW };
    const times = computeSlots(base).slots.map((s) => s.time);
    assert.ok(!times.includes("09:30") && !times.includes("10:00") && !times.includes("11:00"));
    assert.ok(times.includes("09:00") && times.includes("11:30"));
    const mine = computeSlots({ ...base, excludeBookingId: "1" }).slots.map((s) => s.time);
    assert.ok(mine.includes("10:00"));
  });

  it("respeta la anticipación mínima", () => {
    const now = localToDate(DATE, "12:10");
    const r = computeSlots({ date: DATE, durationMin: 30, professionalIds: ["a"], hours: SEED_HOURS, busy: [], now });
    assert.equal(r.slots[0]?.time, "13:30");
  });
});

describe("placementConflicts (carga manual)", () => {
  const base = {
    date: DATE,
    time: "10:00",
    durationMin: 60,
    hours: SEED_HOURS,
    service: { name: "Kapping", active: true },
    professional: { id: "a", name: "A", active: true, doesService: true },
    busy: [] as BusyBooking[],
  };
  it("sin conflictos", () => assert.deepEqual(placementConflicts(base), []));
  it("superposición, fuera de horario y profesional que no lo hace", () => {
    const types = placementConflicts({
      ...base,
      time: "18:30",
      professional: { ...base.professional, doesService: false },
      busy: [busy("1", "a", "18:00", "19:00")],
    }).map((c) => c.type);
    assert.deepEqual(types.sort(), ["outside_hours", "overlap", "professional_service"]);
  });
  it("ignora el turno que se está editando", () => {
    assert.deepEqual(placementConflicts({ ...base, busy: [busy("1", "a", "10:00", "11:00")], excludeBookingId: "1" }), []);
  });
});

describe("identificación de la clienta", () => {
  it("normaliza el código", () => {
    assert.equal(normalizeCode(" slk-ab12cd "), "SLK-AB12CD");
    assert.equal(normalizeCode("ab12cd"), "SLK-AB12CD");
  });
  it("teléfono por los últimos 8 dígitos, email sin mayúsculas", () => {
    const c = { phone: "1134208344", email: "Ana@Mail.com" };
    assert.ok(contactMatches("+54 9 11 3420-8344", c));
    assert.ok(contactMatches("ana@mail.com", c));
    assert.ok(!contactMatches("11 3420-8345", c));
    assert.ok(!contactMatches("3420", c));
    assert.ok(!contactMatches("otra@mail.com", c));
  });
  it("cambios online hasta una hora antes", () => {
    const start = localToDate(DATE, "10:00");
    assert.ok(canCustomerChange(start, localToDate(DATE, "09:00")));
    assert.ok(!canCustomerChange(start, localToDate(DATE, "09:01")));
  });
});

it("uniqueSlug", () => {
  const taken = new Set(["unas-esculpidas"]);
  assert.equal(uniqueSlug("Uñas esculpidas", (x) => taken.has(x)), "unas-esculpidas-2");
  assert.equal(uniqueSlug("Sofía", () => false, "pro-"), "pro-sofia");
});
