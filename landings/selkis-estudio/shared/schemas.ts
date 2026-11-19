// Validación (zod) de todo lo que entra a la API. La misma en Express y en la demo estática.
import { z } from "zod";
import { es } from "zod/locales";

// Mensajes por defecto en castellano (para lo que no tiene uno propio).
z.config(es());

export const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string({ error: "Elegí una fecha" }).regex(dateRe, "Fecha inválida (AAAA-MM-DD)");
const time = z
  .string({ error: "Elegí un horario" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario inválido (HH:MM)");
const id = z.string({ error: "Falta elegir" }).trim().min(1, "Falta elegir");

const name = z.string({ error: "Ingresá el nombre" }).trim().min(2, "Ingresá el nombre").max(80, "Máximo 80 caracteres");
const phone = z
  .string({ error: "Ingresá un teléfono" })
  .trim()
  .transform((s) => s.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "Teléfono inválido"));
const email = z.string({ error: "Ingresá un email" }).trim().pipe(z.email("Email inválido").max(120, "Email demasiado largo"));
const optional = <T extends z.ZodType>(schema: T) =>
  z.union([z.literal("").transform(() => ""), schema]).optional().default("");

// ---- Público ----
export const availabilityQuery = z.object({
  serviceId: id,
  date,
  professionalId: id.optional(),
});

export const bookingBody = z.object({
  serviceId: id,
  professionalId: id.optional(),
  date,
  time,
  name,
  phone,
  email,
  /** Honeypot: campo oculto que las personas no ven ni completan. */
  website: z.string().max(200).optional().default(""),
  /** Milisegundos desde que se abrió el flujo de reserva (tiempo mínimo de llenado). */
  fillMs: z.number({ error: "Recargá la página y probá de nuevo." }).int().min(0),
});
export type BookingBody = z.input<typeof bookingBody>;

// ---- Gestionar mi turno (código + teléfono o email) ----
export const manageAuth = z.object({
  code: z.string({ error: "Ingresá el código de reserva" }).trim().min(4, "Ingresá el código de reserva").max(20),
  contact: z
    .string({ error: "Ingresá tu teléfono o email" })
    .trim()
    .min(6, "Ingresá el teléfono o el email con el que reservaste")
    .max(120),
});
export type ManageAuth = z.input<typeof manageAuth>;

export const manageAvailability = manageAuth.extend({ serviceId: id, date, professionalId: id.optional() });
export type ManageAvailabilityBody = z.input<typeof manageAvailability>;

export const manageChange = manageAuth.extend({ serviceId: id, professionalId: id.optional(), date, time });
export type ManageChangeBody = z.input<typeof manageChange>;

// ---- Admin ----
export const adminBookingQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  status: z.enum(["confirmed", "cancelled", "all"]).default("all"),
  professionalId: id.optional(),
});
export type AdminBookingQuery = z.input<typeof adminBookingQuery>;

export const adminBookingBody = z.object({
  serviceId: id,
  professionalId: id,
  date,
  time,
  name,
  phone: optional(phone),
  email: optional(email),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().default(""),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  /** Guardar aunque haya conflictos (superposición, fuera de horario…). */
  force: z.boolean().optional().default(false),
});
export type AdminBookingBody = z.input<typeof adminBookingBody>;

const ids = z.array(z.string().trim().min(1)).max(100).optional();

export const serviceBody = z.object({
  name: z.string({ error: "Ingresá el nombre" }).trim().min(2, "Ingresá el nombre").max(80, "Máximo 80 caracteres"),
  category: z.string({ error: "Ingresá la categoría" }).trim().min(2, "Ingresá la categoría").max(40, "Máximo 40 caracteres"),
  description: z.string().trim().max(300, "Máximo 300 caracteres").optional().default(""),
  durationMin: z
    .number({ error: "Ingresá la duración en minutos" })
    .int("La duración va en minutos enteros")
    .min(15, "Mínimo 15 minutos")
    .max(480, "Máximo 8 horas")
    .refine((n) => n % 15 === 0, "Usá múltiplos de 15 minutos"),
  priceFrom: z
    .number({ error: "Ingresá el precio" })
    .int("El precio va sin centavos")
    .min(0, "El precio no puede ser negativo")
    .max(10_000_000, "Precio demasiado alto"),
  active: z.boolean().optional().default(true),
  professionalIds: ids,
});
export type ServiceBody = z.input<typeof serviceBody>;

export const professionalBody = z.object({
  name: z.string({ error: "Ingresá el nombre" }).trim().min(2, "Ingresá el nombre").max(60, "Máximo 60 caracteres"),
  specialty: z.string().trim().max(80, "Máximo 80 caracteres").optional().default(""),
  active: z.boolean().optional().default(true),
  serviceIds: ids,
});
export type ProfessionalBody = z.input<typeof professionalBody>;

/** Errores de zod → { campo: [mensajes] } (lo que devuelve la API en `issues`). */
export const fieldIssues = (error: z.ZodError) => z.flattenError(error).fieldErrors as Record<string, string[]>;
