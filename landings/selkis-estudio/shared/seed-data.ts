// Datos iniciales del estudio. Una sola fuente para:
//   - prisma/seed.ts (la base SQLite del modo Express),
//   - web/src/demo-api.ts (la demo estática, que los copia a localStorage),
//   - el prerender del landing (scripts/prerender.mjs vía web/src/entry-server.tsx).
// Precios ORIENTATIVOS de muestra: Selkis no publica lista de precios; confirmar con el estudio.
import type { PublicData } from "./types.ts";

export interface SeedService {
  id: string;
  category: string;
  name: string;
  description: string;
  durationMin: number;
  priceFrom: number;
}

export interface SeedProfessional {
  id: string;
  name: string;
  specialty: string;
  services: string[];
}

export interface SeedHour {
  weekday: number;
  open: string;
  close: string;
}

export const SEED_SERVICES: SeedService[] = [
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

// Nombres de muestra (no son el staff real).
export const SEED_PROFESSIONALS: SeedProfessional[] = [
  { id: "pro-a", name: "Profesional A", specialty: "Uñas & nail art", services: ["semi-manos", "kapping-gel", "esculpidas", "nail-art", "pies-semi"] },
  { id: "pro-b", name: "Profesional B", specialty: "Uñas & pies", services: ["semi-manos", "kapping-gel", "nail-art", "pies-semi"] },
  { id: "pro-c", name: "Profesional C", specialty: "Cejas, pestañas & láser", services: ["lifting-pestanas", "perfilado-cejas", "laser-zona-chica", "laser-piernas"] },
];

// Horarios publicados en su ficha de Google Maps (lunes 13–19, mar–vie 9–19, sáb 9–18).
export const SEED_HOURS: SeedHour[] = [
  { weekday: 1, open: "13:00", close: "19:00" },
  { weekday: 2, open: "09:00", close: "19:00" },
  { weekday: 3, open: "09:00", close: "19:00" },
  { weekday: 4, open: "09:00", close: "19:00" },
  { weekday: 5, open: "09:00", close: "19:00" },
  { weekday: 6, open: "09:00", close: "18:00" },
];

/** El catálogo público tal como lo devolvería GET /api/services recién seedeado (para el prerender). */
export function seedPublicData(): PublicData {
  return {
    services: SEED_SERVICES.map((s) => ({
      ...s,
      professionals: SEED_PROFESSIONALS.filter((p) => p.services.includes(s.id)).map(({ id, name, specialty }) => ({
        id,
        name,
        specialty,
      })),
    })),
    hours: SEED_HOURS,
    professionals: SEED_PROFESSIONALS.map(({ services, ...p }) => ({ ...p, serviceIds: services })),
  };
}
