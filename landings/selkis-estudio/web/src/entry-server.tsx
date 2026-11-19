import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";

/** Prerender del landing en el build (lo usa scripts/prerender.mjs). */
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
