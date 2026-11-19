// Backend simulado en el navegador para la demo estática (GitHub Pages, VITE_STATIC_DEMO=1).
// Replica prisma/seed.ts + server/src/availability.ts + server/src/routes.ts: mismos datos,
// misma lógica de horarios (hora de Buenos Aires) y mismas formas de error (ApiError).
// Los turnos se guardan en localStorage de este navegador (si no hay storage, quedan en memoria).
import { ApiError, type Booking, type BusinessHour, type Service, type Slot } from "./api";

// ---- Seed (copia de prisma/seed.ts) ----
const SERVICES = [
  { id: "semi-manos", category: "Uñas", name: "Esmaltado semipermanente", description: "Manos, con preparación de cutícula y limado. Gran paleta de colores.", durationMin: 60, priceFrom: 18000 },
  { id: "kapping-gel", category: "Uñas", name: "Kapping gel", description: "Gel sobre la uña natural para que crezca fuerte. Pensado para durar hasta 20 días.", durationMin: 90, priceFrom: 24000 },
  { id: "esculpidas", category: "Uñas", name: "Uñas esculpidas", description: "Extensión esculpida en gel o acrílico, con la forma y el largo que quieras.", durationMin: 120, priceFrom: 32000 },
  { id: "nail-art", category: "Uñas", name: "Semi + nail art", description: "Semipermanente con diseño a medida: traé tu idea y la hacemos realidad.", durationMin: 90, priceFrom: 23000 },
  { id: "pies-semi", category: "Pies", name: "Pedicuría con semipermanente", description: "Pies en seco, cutículas, durezas y esmaltado semipermanente.", durationMin: 60, priceFrom: 22000 },
  { id: "lifting-pestanas", category: "Cejas & pestañas", name: "Lifting de pestañas", description: "Curvatura y tinte para una mirada abierta, sin extensiones.", durationMin: 60, priceFrom: 22000 },
  { id: "perfilado-cejas", category: "Cejas & pestañas", name: "Perfilado de cejas", description: "Diseño según tu rostro, con pinza y/o cera.", durationMin: 30, priceFrom: 12000 },
  { id: "laser-zona-chica", category: "Depilación láser", name: "Láser · zona chica", description: "Axilas, bozo, cavado simple u otra zona chica, por sesión.", durationMin: 30, priceFrom: 15000 },
  { id: "laser-piernas", category: "Depilación láser", name: "Láser · piernas completas", description: "Sesión de piernas enteras. Consultá por packs.", durationMin: 60, priceFrom: 38000 },
];

const PROFESSIONALS = [
  { id: "pro-a", name: "Profesional A", specialty: "Uñas & nail art", services: ["semi-manos", "kapping-gel", "esculpidas", "nail-art", "pies-semi"] },
  { id: "pro-b", name: "Profesional B", specialty: "Uñas & pies", services: ["semi-manos", "kapping-gel", "nail-art", "pies-semi"] },
  { id: "pro-c", name: "Profesional C", specialty: "Cejas, pestañas & láser", services: ["lifting-pestanas", "perfilado-cejas", "laser-zona-chica", "laser-piernas"] },
];

const HOURS: BusinessHour[] = [
  { weekday: 1, open: "13:00", close: "19:00" },
  { weekday: 2, open: "09:00", close: "19:00" },
  { weekday: 3, open: "09:00", close: "19:00" },
  { weekday: 4, open: "09:00", close: "19:00" },
  { weekday: 5, open: "09:00", close: "19:00" },
  { weekday: 6, open: "09:00", close: "18:00" },
];

const services: Service[] = SERVICES.map((s) => ({
  ...s,
  professionals: PROFESSIONALS.filter((p) => p.services.includes(s.id)).map(({ id, name, specialty }) => ({ id, name, specialty })),
}));

// ---- Hora de Buenos Aires (copia de server/src/time.ts: UTC-3 todo el año) ----
const TZ_OFFSET = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const localToDate = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00${TZ_OFFSET}`);
const toLocalHHMM = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16);
const toLocalDate = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
const weekdayOf = (date: string) => new Date(`${date}T12:00:00${TZ_OFFSET}`).getUTCDay();
const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const minToHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// ---- Reglas (copia de server/src/availability.ts) ----
const SLOT_STEP_MIN = 30;
const MIN_LEAD_MIN = 60;
const MAX_DAYS_AHEAD = 60;

// ---- Persistencia ----
interface StoredBooking {
  id: string;
  code: string;
  status: "confirmed" | "cancelled";
  serviceId: string;
  professionalId: string;
  start: string; // ISO UTC
  end: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
  cancelledAt?: string;
}

const STORAGE_KEY = "selkis-demo-bookings";
let memory: StoredBooking[] = [];

function load(): StoredBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) memory = parsed as StoredBooking[];
    }
  } catch {
    /* sin storage: seguimos en memoria */
  }
  return memory;
}

function save(list: StoredBooking[]) {
  memory = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* sin storage: queda en memoria hasta recargar */
  }
}

const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const newId = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : randomHex(16));
const newCode = () => `SLK-${randomHex(3).toUpperCase()}`;

function serialize(b: StoredBooking): Booking {
  const s = services.find((x) => x.id === b.serviceId);
  const p = PROFESSIONALS.find((x) => x.id === b.professionalId);
  const start = new Date(b.start);
  const end = new Date(b.end);
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    date: toLocalDate(start),
    time: toLocalHHMM(start),
    endTime: toLocalHHMM(end),
    service: { id: b.serviceId, name: s?.name ?? b.serviceId, durationMin: s?.durationMin ?? 0 },
    professional: { id: b.professionalId, name: p?.name ?? b.professionalId },
    customer: { name: b.customerName, phone: b.customerPhone, email: b.customerEmail },
    createdAt: b.createdAt,
  };
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function availability(serviceId: string, date: string, professionalId?: string, now = new Date()) {
  const service = services.find((s) => s.id === serviceId);
  if (!service) throw new ApiError(404, { error: "service_not_found" });
  if (!dateRe.test(date)) throw new ApiError(400, { error: "invalid_query", issues: { date: ["Formato YYYY-MM-DD"] } });
  const pros = service.professionals.filter((p) => !professionalId || p.id === professionalId);
  if (pros.length === 0) throw new ApiError(404, { error: "professional_not_found" });

  const hours = HOURS.find((h) => h.weekday === weekdayOf(date));
  const dayStart = localToDate(date, "00:00");
  const maxDate = new Date(now.getTime() + MAX_DAYS_AHEAD * 86_400_000);
  if (!hours || dayStart > maxDate) return { service, slots: [] as Slot[], closed: !hours };

  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const proIds = pros.map((p) => p.id);
  const busy = load()
    .filter((b) => b.status === "confirmed" && proIds.includes(b.professionalId))
    .map((b) => ({ professionalId: b.professionalId, start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => b.start < dayEnd && b.end > dayStart);

  const earliest = new Date(now.getTime() + MIN_LEAD_MIN * 60_000);
  const closeMin = hhmmToMin(hours.close);
  const slots: Slot[] = [];
  for (let m = hhmmToMin(hours.open); m + service.durationMin <= closeMin; m += SLOT_STEP_MIN) {
    const time = minToHHMM(m);
    const start = localToDate(date, time);
    if (start < earliest) continue;
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    const free = proIds.filter((id) => !busy.some((b) => b.professionalId === id && b.start < end && start < b.end));
    if (free.length > 0) slots.push({ time, start: start.toISOString(), professionalIds: free });
  }
  return { service, slots, closed: false };
}

export const getServices = () => delay({ services, hours: HOURS });

export const getAvailability = async (serviceId: string, date: string, professionalId?: string) => {
  const r = availability(serviceId, date, professionalId);
  return delay({ slots: r.slots, closed: r.closed, durationMin: r.service.durationMin });
};

export async function createBooking(data: {
  serviceId: string;
  professionalId?: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
}): Promise<Booking> {
  // Misma validación que el bookingBody (zod) del server.
  const issues: Record<string, string[]> = {};
  const name = data.name.trim();
  const phone = data.phone.trim().replace(/[\s()-]/g, "");
  const email = data.email.trim();
  if (name.length < 2 || name.length > 80) issues.name = ["Ingresá tu nombre"];
  if (!/^\+?\d{8,15}$/.test(phone)) issues.phone = ["Teléfono inválido"];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) issues.email = ["Email inválido"];
  if (!dateRe.test(data.date)) issues.date = ["Invalid"];
  if (!/^\d{2}:\d{2}$/.test(data.time)) issues.time = ["Invalid"];
  if (Object.keys(issues).length > 0) throw new ApiError(400, { error: "invalid_body", issues });

  const avail = availability(data.serviceId, data.date, data.professionalId);
  const slot = avail.slots.find((s) => s.time === data.time);
  if (!slot) throw new ApiError(409, { error: "slot_unavailable", message: "Ese horario ya no está disponible." });
  const start = localToDate(data.date, data.time);
  const booking: StoredBooking = {
    id: newId(),
    code: newCode(),
    status: "confirmed",
    serviceId: data.serviceId,
    professionalId: data.professionalId ?? slot.professionalIds[0]!,
    start: start.toISOString(),
    end: new Date(start.getTime() + avail.service.durationMin * 60_000).toISOString(),
    customerName: name,
    customerPhone: phone,
    customerEmail: email,
    createdAt: new Date().toISOString(),
  };
  save([...load(), booking]);
  return delay(serialize(booking));
}

/** En la demo estática cualquier clave no vacía entra (no hay secreto que proteger: los datos viven en tu navegador). */
function requireAdmin(key: string) {
  if (!key.trim()) throw new ApiError(401, { error: "unauthorized" });
}

export async function listBookings(key: string) {
  requireAdmin(key);
  const bookings = [...load()].sort((a, b) => a.start.localeCompare(b.start)).map(serialize);
  return delay({ bookings });
}

export async function cancelBooking(key: string, id: string) {
  requireAdmin(key);
  const list = load();
  const existing = list.find((b) => b.id === id);
  if (!existing) throw new ApiError(404, { error: "not_found" });
  const updated: StoredBooking = { ...existing, status: "cancelled", cancelledAt: existing.cancelledAt ?? new Date().toISOString() };
  save(list.map((b) => (b.id === id ? updated : b)));
  return delay(serialize(updated));
}
