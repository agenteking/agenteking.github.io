// Formas de la API (JSON). Las usan el server (Express), la demo estática y el front.

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
  /** Profesionales activos que hacen el servicio. */
  professionals: Professional[];
}

export interface TeamMember extends Professional {
  serviceIds: string[];
}

export interface BusinessHour {
  weekday: number;
  open: string;
  close: string;
}

/** GET /api/services: lo que ve el sitio público (y lo que se prerenderiza). */
export interface PublicData {
  services: Service[];
  hours: BusinessHour[];
  professionals: TeamMember[];
}

export interface Slot {
  time: string;
  start: string;
  professionalIds: string[];
}

export interface AvailabilityResult {
  slots: Slot[];
  closed: boolean;
  durationMin: number;
}

export type BookingStatus = "confirmed" | "cancelled";
export type BookingSource = "online" | "admin";

export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  source: BookingSource;
  date: string;
  time: string;
  endTime: string;
  start: string;
  end: string;
  service: { id: string; name: string; durationMin: number; priceFrom: number };
  professional: { id: string; name: string };
  customer: { name: string; phone: string; email: string };
  notes: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

/** Lo que ve la clienta en "Gestionar mi turno". */
export interface MyBooking extends Booking {
  /** Se puede cambiar o cancelar online (falta más que la anticipación mínima). */
  canChange: boolean;
}

export interface BookingEvent {
  id: string;
  action: "created" | "updated" | "rescheduled" | "cancelled" | "reactivated";
  actor: "customer" | "admin";
  detail: string;
  createdAt: string;
}

export interface BookingWithHistory extends Booking {
  events: BookingEvent[];
}

export interface AdminService {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  priceFrom: number;
  active: boolean;
  sortOrder: number;
  professionalIds: string[];
  futureBookings: number;
  totalBookings: number;
}

export interface AdminProfessional {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
  sortOrder: number;
  serviceIds: string[];
  futureBookings: number;
  totalBookings: number;
}

export type ConflictType =
  | "overlap"
  | "closed"
  | "outside_hours"
  | "professional_service"
  | "inactive_service"
  | "inactive_professional";

export interface Conflict {
  type: ConflictType;
  message: string;
}

/** Cuerpo de error de la API. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  issues?: Record<string, string[]>;
  conflicts?: Conflict[];
  futureBookings?: number;
}
