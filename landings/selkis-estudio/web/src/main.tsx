import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./styles.css";
import { StrictMode, Suspense, lazy, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

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
  // HTML prerenderizado en el build (scripts/prerender.mjs): solo hidratamos.
  // En una transición React hidrata en tramos cortos y no bloquea el hilo principal.
  startTransition(() => {
    hydrateRoot(
      el,
      <StrictMode>
        <App />
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
