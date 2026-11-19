import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { PublicData } from "./api";
import { App } from "./App";

// canonical + OG + JSON-LD (web/src/site-seo.ts), con el mismo catálogo que el HTML.
export { headFor } from "./site-seo";
export { canonicalUrl } from "./seo";
export { seedPublicData } from "../../shared/seed-data";

/**
 * Render del landing con un catálogo dado: lo usan scripts/prerender.mjs (build, con el seed)
 * y el server Express (por request, con la base viva; ver server/src/ssr.ts).
 */
export function render(data: PublicData) {
  return renderToString(
    <StrictMode>
      <App initialData={data} />
    </StrictMode>,
  );
}
