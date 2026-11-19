import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./styles.css";
import { StrictMode, Suspense, lazy, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import type { PublicData } from "./api";

const Admin = lazy(() => import("./admin/Admin"));

const el = document.getElementById("root")!;
// El panel vive en <base>admin (con Express "/admin"; en GitHub Pages "/<landing>/admin/").
const isAdmin = window.location.pathname.replace(/\/$/, "") === `${import.meta.env.BASE_URL}admin`;

if (isAdmin) {
  el.innerHTML = "";
  createRoot(el).render(
    <StrictMode>
      <Suspense fallback={<div className="page-loading">Cargando panel…</div>}>
        <Admin />
      </Suspense>
    </StrictMode>,
  );
} else if (el.hasChildNodes()) {
  // HTML prerenderizado (build) o renderizado por Express con la base viva: solo hidratamos, con el
  // mismo catálogo con el que se armó el HTML (<script id="selkis-data">). Después App pide los datos vivos.
  // En una transición React hidrata en tramos cortos y no bloquea el hilo principal.
  let initialData: PublicData | null = null;
  try {
    initialData = JSON.parse(document.getElementById("selkis-data")?.textContent ?? "null") as PublicData | null;
  } catch {
    /* sin datos embebidos: App los pide a la API */
  }
  startTransition(() => {
    hydrateRoot(
      el,
      <StrictMode>
        <App initialData={initialData} />
      </StrictMode>,
    );
  });
} else {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
