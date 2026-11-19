import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";

export { headTags, sitemapXml } from "./head";
export { BRAND_NAME } from "./config";

/** Prerender del landing en el build (lo usa scripts/prerender.mjs). */
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
