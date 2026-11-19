// Prerender estático del landing: inyecta el HTML de <App/> en dist/web/index.html
// para que el primer paint no dependa del JS (después React hidrata).
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const indexPath = `${root}dist/web/index.html`;
const ssrDir = `${root}dist/ssr`;
// Misma base que web/vite.config.ts (BASE_PATH; "/" por defecto).
const base = `/${(process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

const { render } = await import(pathToFileURL(`${ssrDir}/entry-server.js`).href);
let html = await readFile(indexPath, "utf8");

// Preload de las fuentes latin que se ven arriba del pliegue (evita el salto al cambiar de fuente).
const assets = await readdir(`${root}dist/web/assets`);
const fonts = [/^manrope-latin-wght-normal-.*\.woff2$/, /^fraunces-latin-wght-normal-.*\.woff2$/, /^fraunces-latin-wght-italic-.*\.woff2$/]
  .map((re) => assets.find((a) => re.test(a)))
  .filter(Boolean)
  .map((f) => `<link rel="preload" as="font" type="font/woff2" href="${base}assets/${f}" crossorigin />`)
  .join("\n    ");
html = html.replace("</title>", `</title>\n    ${fonts}`);
// Demo estática (GitHub Pages no tiene fallback de rutas): el panel se sirve desde <base>admin/index.html,
// con el HTML sin prerender (main.tsx detecta la ruta y monta el panel).
if (process.env.VITE_STATIC_DEMO === "1") {
  await mkdir(`${root}dist/web/admin`, { recursive: true });
  await writeFile(`${root}dist/web/admin/index.html`, html);
}
const app = render();
if (!html.includes('<div id="root"></div>')) throw new Error("No encontré <div id=root> en index.html");
await writeFile(indexPath, html.replace('<div id="root"></div>', `<div id="root">${app}</div>`));
await rm(ssrDir, { recursive: true, force: true });
console.log(`prerender OK (${(app.length / 1024).toFixed(1)} KB de HTML)`);
