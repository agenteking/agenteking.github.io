// Mensajes de error de la API (los mismos en Express y en la demo estática).
import { MAX_ACTIVE_PER_CONTACT } from "./rules.ts";

export const MSG = {
  invalid_body: "Revisá los datos marcados.",
  invalid_query: "Parámetros inválidos.",
  unauthorized: "Clave de administración incorrecta.",
  not_found: "No encontramos lo que buscabas.",
  service_not_found: "Ese servicio no existe o ya no está disponible.",
  professional_not_found: "Esa profesional no existe o no hace este servicio.",
  slot_unavailable: "Ese horario ya no está disponible.",
  booking_not_found: "No encontramos una reserva con ese código y ese teléfono o email. Revisá los datos.",
  booking_cancelled: "Este turno ya está cancelado.",
  too_late: "Falta menos de una hora para el turno: para cambiarlo o cancelarlo escribinos por WhatsApp.",
  too_many_attempts: "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  too_many_admin_attempts: "Demasiados intentos con una clave incorrecta. Esperá 15 minutos y probá de nuevo.",
  too_many_requests: "Demasiadas reservas seguidas desde esta conexión. Esperá unos minutos o escribinos por WhatsApp.",
  too_many_bookings: `Ya tenés ${MAX_ACTIVE_PER_CONTACT} turnos próximos con ese celular o email. Para sacar otro, cambiá o cancelá uno desde “Gestionar mi turno”, o escribinos por WhatsApp.`,
  bot_suspected: "No pudimos tomar la reserva. Esperá unos segundos y probá de nuevo, o escribinos por WhatsApp.",
  conflicts: "El turno choca con la agenda. Revisá los avisos o guardalo igual.",
  has_future_bookings: "Tiene turnos próximos confirmados: no se puede eliminar. Desactivalo o reasigná esos turnos.",
  has_history: "Tiene turnos en el historial: para no perderlos, desactivalo en vez de eliminarlo.",
  internal_error: "Algo salió mal. Probá de nuevo en un rato.",
} as const;

export type ErrorCode = keyof typeof MSG;
