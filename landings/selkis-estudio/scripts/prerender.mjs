// Prerender estático del landing: inyecta el HTML de <App/> en dist/web/index.html
// para que el primer paint no dependa del JS (después React hidrata).
// - El HTML se arma con el catálogo del seed (shared/seed-data.ts) y ese mismo catálogo va en
//   <script id="selkis-data"> para que la hidratación coincida; después el front pide los datos vivos.
// - Con Express, además queda dist/ssr/{entry-server.js,template.html}: el server renderiza el
//   landing por request con la base de datos (server/src/ssr.ts), así el HTML ya trae lo cargado
//   en el panel. En los builds para hosting estático (GitHub Pages: VITE_STATIC_DEMO=1 o VITE_API_BASE con la
//   API en Supabase) dist/ssr se borra y el panel sale en <base>admin/index.html.
// - <!--app-head--> (web/index.html) → canonical + OG + JSON-LD del negocio con el mismo catálogo
//   (web/src/site-seo.ts). La URL canónica = SITE_URL (o VITE_SITE_URL, la de GitHub Pages) + BASE_PATH.
//   En dist/ssr/template.html el marcador queda, y Express lo completa con la base viva.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const indexPath = `${root}dist/web/index.html`;
const ssrDir = `${root}dist/ssr`;
const staticDemo = process.env.VITE_STATIC_DEMO === "1";
// Front servido como archivos estáticos (GitHub Pages): demo en el navegador o API remota (Supabase).
const staticHost = staticDemo || !!process.env.VITE_API_BASE;
// Misma base que web/vite.config.ts (BASE_PATH; "/" por defecto).
const base = `/${(process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

const { render, seedPublicData, headFor, canonicalUrl } = await import(pathToFileURL(`${ssrDir}/entry-server.js`).href);
let html = await readFile(indexPath, "utf8");
const siteUrl =
  process.env.SITE_URL || process.env.VITE_SITE_URL || (staticHost ? "https://agenteking.github.io" : `http://localhost:${process.env.PORT ?? 4310}`);
const url = canonicalUrl(siteUrl, base);
if (!html.includes("<!--app-head-->")) throw new Error("No encontré <!--app-head--> en index.html");

// Preload de las fuentes latin que se ven arriba del pliegue (evita el salto al cambiar de fuente).
const assets = await readdir(`${root}dist/web/assets`);
const fonts = [/^manrope-latin-wght-normal-.*\.woff2$/, /^fraunces-latin-wght-normal-.*\.woff2$/, /^fraunces-latin-wght-italic-.*\.woff2$/]
  .map((re) => assets.find((a) => re.test(a)))
  .filter(Boolean)
  .map((f) => `<link rel="preload" as="font" type="font/woff2" href="${base}assets/${f}" crossorigin />`)
  .join("\n    ");
html = html.replace("</title>", `</title>\n    ${fonts}`);
// Hosting estático (GitHub Pages no tiene fallback de rutas): el panel se sirve desde <base>admin/index.html,
// con el HTML sin prerender (main.tsx detecta la ruta y monta el panel).
if (staticHost) {
  await mkdir(`${root}dist/web/admin`, { recursive: true });
  await writeFile(`${root}dist/web/admin/index.html`, html.replace("<!--app-head-->", ""));
}

if (!html.includes('<div id="root"></div>')) throw new Error("No encontré <div id=root> en index.html");
const template = html
  .replace('<div id="root"></div>', '<div id="root"><!--ssr-outlet--></div>')
  .replace("</body>", "  <!--ssr-data-->\n  </body>");
const data = seedPublicData();
const app = render(data);
const json = JSON.stringify(data).replace(/</g, "\\u003c");
await writeFile(
  indexPath,
  template
    .replace("<!--app-head-->", () => headFor(data, url))
    .replace("<!--ssr-outlet-->", () => app)
    .replace("<!--ssr-data-->", () => `<script id="selkis-data" type="application/json">${json}</script>`),
);

if (staticHost) await rm(ssrDir, { recursive: true, force: true });
else await writeFile(`${ssrDir}/template.html`, template);
console.log(`prerender OK (${(app.length / 1024).toFixed(1)} KB de HTML · canonical ${url})${staticHost ? "" : " · SSR en vivo: dist/ssr"}`);
