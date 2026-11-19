import { createContext, useContext } from "react";
import type { AdminProfessional, AdminService } from "../api";

export interface Catalog {
  services: AdminService[];
  professionals: AdminProfessional[];
}

export interface AdminCtx {
  adminKey: string;
  catalog: Catalog;
  /** Vuelve a pedir servicios y profesionales (después de un cambio). */
  reloadCatalog: () => Promise<void>;
  /** Aviso corto de éxito arriba del panel. */
  flash: (msg: string) => void;
  /** Manejo común de errores (401 → login). */
  onError: (e: unknown) => void;
}

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin fuera de AdminContext");
  return ctx;
}

/** Hoy en Buenos Aires (YYYY-MM-DD). */
export const todayBA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

export const shortDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(`${date}T12:00:00-03:00`));
