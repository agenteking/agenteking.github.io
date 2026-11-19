import "@fontsource-variable/geist/wght.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./styles.css";
import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const el = document.getElementById("root")!;

if (el.hasChildNodes()) {
  // HTML prerenderizado en el build (scripts/prerender.mjs): solo hidratamos, en tramos que no bloquean.
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
