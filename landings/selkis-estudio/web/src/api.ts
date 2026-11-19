export interface Professional {
  id: string;
  name: string;
  specialty: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  priceFrom: number;
  professionals: Professional[];
}

export interface BusinessHour {
  weekday: number;
  open: string;
  close: string;
}

export interface Slot {
  time: string;
  start: string;
  professionalIds: string[];
}

export interface Booking {
  id: string;
  code: string;
  status: "confirmed" | "cancelled";
  date: string;
  time: string;
  endTime: string;
  service: { id: string; name: string; durationMin: number };
  professional: { id: string; name: string };
  customer: { name: string; phone: string; email: string };
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; issues?: Record<string, string[]> },
  ) {
    super(body.message ?? body.error ?? `HTTP ${status}`);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

let servicesCache: Promise<{ services: Service[]; hours: BusinessHour[] }> | null = null;
export const getServices = () => (servicesCache ??= req("/api/services"));

export const getAvailability = (serviceId: string, date: string, professionalId?: string) => {
  const q = new URLSearchParams({ serviceId, date });
  if (professionalId) q.set("professionalId", professionalId);
  return req<{ slots: Slot[]; closed: boolean; durationMin: number }>(`/api/availability?${q}`);
};

export const createBooking = (data: {
  serviceId: string;
  professionalId?: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
}) => req<Booking>("/api/bookings", { method: "POST", body: JSON.stringify(data) });

export const listBookings = (key: string) =>
  req<{ bookings: Booking[] }>("/api/bookings?status=all", { headers: { "x-admin-key": key } });

export const cancelBooking = (key: string, id: string) =>
  req<Booking>(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: { "x-admin-key": key } });

export const formatARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export const formatDuration = (min: number) =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`;
