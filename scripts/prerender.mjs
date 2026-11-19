// Prerender estático del landing: inyecta <head> (SEO, OG, JSON-LD) y el HTML de <App/> en
// dist/web/index.html para que el primer paint no dependa del JS (después React hidrata).
// También escribe dist/web/sitemap.xml.
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const webDir = `${root}dist/web`;
const indexPath = `${webDir}/index.html`;
const ssrDir = `${root}dist/ssr`;

const { render, headTags, sitemapXml, BRAND_NAME } = await import(pathToFileURL(`${ssrDir}/entry-server.js`).href);
let html = await readFile(indexPath, "utf8");

// Preload de la fuente latin que se ve arriba del pliegue (evita el salto al cambiar de fuente).
const assets = await readdir(`${webDir}/assets`);
const fonts = [/^geist-latin-wght-normal-.*\.woff2$/]
  .map((re) => assets.find((a) => re.test(a)))
  .filter(Boolean)
  .map((f) => `<link rel="preload" as="font" type="font/woff2" href="/assets/${f}" crossorigin />`);

if (!html.includes("<!--app-head-->")) throw new Error("No encontré <!--app-head--> en index.html");
html = html.replace("<!--app-head-->", [headTags(), ...fonts].join("\n    "));

// CSS inline: es chico (~8 KB gz) y así no bloquea el primer render con un request extra.
for (const css of assets.filter((a) => /^index-.*\.css$/.test(a))) {
  const tag = new RegExp(`<link rel="stylesheet"[^>]*href="/assets/${css.replace(/[.]/g, "\\.")}"[^>]*>`);
  if (!tag.test(html)) continue;
  const content = await readFile(`${webDir}/assets/${css}`, "utf8");
  html = html.replace(tag, () => `<style>${content}</style>`);
}

const app = render();
if (!html.includes('<div id="root"></div>')) throw new Error("No encontré <div id=root> en index.html");
html = html.replace('<div id="root"></div>', `<div id="root">${app}</div>`);
await writeFile(indexPath, html);
await writeFile(`${webDir}/sitemap.xml`, sitemapXml());
await rm(ssrDir, { recursive: true, force: true });
console.log(`prerender OK · marca "${BRAND_NAME}" · ${(app.length / 1024).toFixed(1)} KB de HTML`);
