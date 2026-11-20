// Cliente de la API. Tres modos según el build:
//   - default: misma origen, /api/… (Express sirve front + API).
//   - VITE_API_BASE=https://<ref>.supabase.co/functions/v1/selkis: front estático (GitHub Pages) contra la
//     API real en la Edge Function de Supabase (<base>/api/…, con CORS).
//   - VITE_STATIC_DEMO=1: sin backend; demo-api.ts resuelve todo en el navegador (localStorage), con las
//     mismas reglas y los mismos errores. Tiene prioridad sobre VITE_API_BASE.
import type {
  AdminProfessional,
  AdminService,
  ApiErrorBody,
  AvailabilityResult,
  Booking,
  BookingWithHistory,
  MyBooking,
  PublicData,
} from "../../shared/types";
import type {
  AdminBookingBody,
  AdminBookingQuery,
  BookingBody,
  ManageAuth,
  ManageAvailabilityBody,
  ManageChangeBody,
  ProfessionalBody,
  ServiceBody,
} from "../../shared/schemas";

export type * from "../../shared/types";
export type {
  AdminBookingBody,
  AdminBookingQuery,
  BookingBody,
  ManageAuth,
  ManageAvailabilityBody,
  ManageChangeBody,
  ProfessionalBody,
  ServiceBody,
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message ?? body.error ?? `HTTP ${status}`);
  }
}

/** Todo lo que el front le pide al backend (Express o la demo estática). */
export interface Backend {
  getServices(): Promise<PublicData>;
  getAvailability(serviceId: string, date: string, professionalId?: string): Promise<AvailabilityResult>;
  createBooking(data: BookingBody): Promise<Booking>;
  // Gestionar mi turno
  findMyBooking(auth: ManageAuth): Promise<MyBooking>;
  myAvailability(q: ManageAvailabilityBody): Promise<AvailabilityResult>;
  changeMyBooking(data: ManageChangeBody): Promise<MyBooking>;
  cancelMyBooking(auth: ManageAuth): Promise<MyBooking>;
  // Panel admin
  adminListBookings(key: string, q?: AdminBookingQuery): Promise<{ bookings: Booking[] }>;
  adminGetBooking(key: string, id: string): Promise<BookingWithHistory>;
  adminCreateBooking(key: string, data: AdminBookingBody): Promise<Booking>;
  adminUpdateBooking(key: string, id: string, data: AdminBookingBody): Promise<Booking>;
  adminCancelBooking(key: string, id: string): Promise<Booking>;
  adminDeleteBooking(key: string, id: string): Promise<void>;
  adminListServices(key: string): Promise<{ services: AdminService[] }>;
  adminCreateService(key: string, data: ServiceBody): Promise<AdminService>;
  adminUpdateService(key: string, id: string, data: ServiceBody): Promise<AdminService>;
  adminDeleteService(key: string, id: string): Promise<void>;
  adminListProfessionals(key: string): Promise<{ professionals: AdminProfessional[] }>;
  adminCreateProfessional(key: string, data: ProfessionalBody): Promise<AdminProfessional>;
  adminUpdateProfessional(key: string, id: string, data: ProfessionalBody): Promise<AdminProfessional>;
  adminDeleteProfessional(key: string, id: string): Promise<void>;
}

/** Origen de la API (sin barra final): vacío = mismo origen que el sitio. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

async function req<T>(path: string, init: RequestInit & { key?: string; json?: unknown } = {}): Promise<T> {
  const { key, json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...rest,
      body: json === undefined ? rest.body : JSON.stringify(json),
      headers: { "Content-Type": "application/json", ...(key ? { "x-admin-key": key } : {}), ...rest.headers },
    });
  } catch {
    throw new ApiError(0, { error: "network", message: "No hay conexión. Revisá internet y probá de nuevo." });
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

const enc = encodeURIComponent;
const qs = (q: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => !!e[1])).toString();

const http: Backend = {
  getServices: () => req("/api/services"),
  getAvailability: (serviceId, date, professionalId) =>
    req(`/api/availability?${qs({ serviceId, date, professionalId })}`),
  createBooking: (data) => req("/api/bookings", { method: "POST", json: data }),
  findMyBooking: (auth) => req("/api/my-booking", { method: "POST", json: auth }),
  myAvailability: (q) => req("/api/my-booking/availability", { method: "POST", json: q }),
  changeMyBooking: (data) => req("/api/my-booking", { method: "PUT", json: data }),
  cancelMyBooking: (auth) => req("/api/my-booking/cancel", { method: "POST", json: auth }),
  adminListBookings: (key, q = {}) =>
    req(`/api/admin/bookings?${qs({ from: q.from, to: q.to, status: q.status, professionalId: q.professionalId })}`, { key }),
  adminGetBooking: (key, id) => req(`/api/admin/bookings/${enc(id)}`, { key }),
  adminCreateBooking: (key, data) => req("/api/admin/bookings", { method: "POST", key, json: data }),
  adminUpdateBooking: (key, id, data) => req(`/api/admin/bookings/${enc(id)}`, { method: "PUT", key, json: data }),
  adminCancelBooking: (key, id) => req(`/api/admin/bookings/${enc(id)}/cancel`, { method: "POST", key }),
  adminDeleteBooking: (key, id) => req(`/api/admin/bookings/${enc(id)}`, { method: "DELETE", key }),
  adminListServices: (key) => req("/api/admin/services", { key }),
  adminCreateService: (key, data) => req("/api/admin/services", { method: "POST", key, json: data }),
  adminUpdateService: (key, id, data) => req(`/api/admin/services/${enc(id)}`, { method: "PUT", key, json: data }),
  adminDeleteService: (key, id) => req(`/api/admin/services/${enc(id)}`, { method: "DELETE", key }),
  adminListProfessionals: (key) => req("/api/admin/professionals", { key }),
  adminCreateProfessional: (key, data) => req("/api/admin/professionals", { method: "POST", key, json: data }),
  adminUpdateProfessional: (key, id, data) =>
    req(`/api/admin/professionals/${enc(id)}`, { method: "PUT", key, json: data }),
  adminDeleteProfessional: (key, id) => req(`/api/admin/professionals/${enc(id)}`, { method: "DELETE", key }),
};

/** Demo estática (GitHub Pages): sin backend, todo se resuelve en el navegador (ver demo-api.ts). */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "1";
const backend = (): Promise<Backend> =>
  STATIC_DEMO ? import("./demo-api").then((m) => m.demoBackend) : Promise.resolve(http);

/** Mismas funciones que `Backend`, apuntando a la API (Express o Supabase) o a la demo según el build. */
export const api = Object.fromEntries(
  (Object.keys(http) as (keyof Backend)[]).map((k) => [
    k,
    (...args: unknown[]) => backend().then((b) => (b[k] as (...a: unknown[]) => Promise<unknown>)(...args)),
  ]),
) as unknown as Backend;

// Catálogo del sitio: se pide una vez por carga de página (el flujo de reserva lo reusa).
let servicesCache: Promise<PublicData> | null = null;
export const getServices = () => {
  servicesCache ??= api.getServices().catch((e: unknown) => {
    servicesCache = null;
    throw e;
  });
  return servicesCache;
};

/** Mensaje para mostrar de un error de la API. */
export const errorMessage = (e: unknown, fallback = "Algo salió mal. Probá de nuevo.") =>
  e instanceof ApiError && e.body.message ? e.body.message : fallback;

/** Primer mensaje por campo de `issues`. */
export const fieldErrors = (e: unknown): Record<string, string> =>
  e instanceof ApiError && e.body.issues
    ? Object.fromEntries(Object.entries(e.body.issues).map(([k, v]) => [k, v[0] ?? "Revisá este dato"]))
    : {};

export const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export const formatDuration = (min: number) =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`;
