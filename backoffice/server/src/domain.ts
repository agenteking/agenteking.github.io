/**
 * Vocabulario compartido entre el server y el front. Tiene que coincidir con
 * `.claude/skills/buscar-leads/scripts/leads.py` (STATUSES, CHANNELS, PARTNERS, WEBSITE_KINDS),
 * que es el dueño del esquema de la base.
 */

export const STATUSES = ["nuevo", "contactado", "respondio", "interesado", "cliente", "descartado"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  respondio: "Respondió",
  interesado: "Interesado",
  cliente: "Cliente",
  descartado: "Descartado",
};

export const CHANNELS = ["mail", "whatsapp", "telefono", "instagram", "en_comercio"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Etiquetas de canal (incluye ids viejos que pueden quedar en el historial). */
export const CHANNEL_LABEL: Record<string, string> = {
  mail: "Mail",
  whatsapp: "WhatsApp",
  telefono: "Teléfono",
  instagram: "Instagram",
  en_comercio: "En comercio",
  facebook: "Facebook",
  otro: "Otro",
};

export const PARTNERS = ["Kanel", "Gonzalo"] as const;
export type Partner = (typeof PARTNERS)[number];

export const WEBSITE_KINDS = ["none", "social_only", "booking", "old", "unknown", "ok"] as const;
export type WebsiteKind = (typeof WEBSITE_KINDS)[number];

export const WEBSITE_KIND_LABEL: Record<WebsiteKind, string> = {
  none: "Sin web",
  social_only: "Solo redes",
  booking: "Página de turnos",
  old: "Web vieja",
  unknown: "Sin revisar",
  ok: "Web ok",
};

export const SOURCE_LABEL: Record<string, string> = {
  google_maps: "Google Maps",
  manual: "Manual",
};

/** Fila de la lista. */
export interface LeadRow {
  id: number;
  name: string;
  category: string | null;
  rubro: string | null;
  address: string | null;
  barrio: string | null;
  phone: string | null;
  phone_norm: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  website_kind: WebsiteKind;
  instagram: string | null;
  facebook: string | null;
  rating: number | null;
  reviews: number | null;
  maps_url: string | null;
  source: string | null;
  status: Status;
  do_not_contact: number;
  no_llame_listed: number | null;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  last_channel: string | null;
  last_by: string | null;
  touches_count: number;
}

export interface Touch {
  id: number;
  at: string;
  channel: string;
  by: string | null;
  summary: string | null;
  outcome: string | null;
}

export interface LeadDetail extends LeadRow {
  lat: number | null;
  lng: number | null;
  website_notes: string | null;
  booking_url: string | null;
  other_socials: string | null;
  search_query: string | null;
  no_llame_checked_at: string | null;
  notes: string | null;
  updated_at: string;
  touches: Touch[];
  deals_count: number;
  payments_count: number;
}
