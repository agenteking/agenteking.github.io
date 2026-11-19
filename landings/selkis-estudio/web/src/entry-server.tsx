import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { PublicData } from "./api";
import { App } from "./App";

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
