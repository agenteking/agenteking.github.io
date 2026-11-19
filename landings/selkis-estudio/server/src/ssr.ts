// Render del landing con los datos vivos de la base (servicios, precios, equipo, horarios), incluido
// el <head>: canonical + JSON-LD (web/src/site-seo.ts), así un cambio del panel también cambia el JSON-LD.
// El build deja dist/ssr/entry-server.js + dist/ssr/template.html (scripts/prerender.mjs).
// Si no están, se sirve el index.html prerenderizado con el seed y el front se actualiza desde /api.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PublicData } from "../../shared/types.js";
import { getCatalogVersion, publicData } from "./store.js";

interface Entry {
  render: (data: PublicData) => string;
  headFor: (data: PublicData, url: string) => string;
  canonicalUrl: (siteUrl: string, basePath?: string) => string;
}

/** JSON seguro dentro de <script> (sin "</script>" ni "<!--"). */
export const safeJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Origen público del sitio (SITE_URL, p. ej. https://selkisestudio.com.ar). Sin él, localhost (avisa index.ts). */
export const siteUrl = () => process.env.SITE_URL || `http://localhost:${process.env.PORT ?? 4310}`;

export function createSsr(ssrDir: string) {
  const entry = path.join(ssrDir, "entry-server.js");
  const templatePath = path.join(ssrDir, "template.html");
  if (!existsSync(entry) || !existsSync(templatePath)) return null;

  let loaded: Promise<Entry & { template: string }> | null = null;
  let cache: { version: number; at: number; html: string } | null = null;

  return async function renderIndex(): Promise<string> {
    loaded ??= Promise.all([import(pathToFileURL(entry).href) as Promise<Entry>, readFile(templatePath, "utf8")]).then(
      ([m, template]) => ({ ...m, template }),
    );
    const version = getCatalogVersion();
    // Se invalida con cada cambio del panel (y cada 30 s, por si la base cambió por fuera, p. ej. un seed).
    if (cache?.version === version && Date.now() - cache.at < 30_000) return cache.html;
    const { render, headFor, canonicalUrl, template } = await loaded;
    const data = await publicData();
    const url = canonicalUrl(siteUrl(), process.env.BASE_PATH ?? "/");
    const html = template
      // Reemplazo con función: el HTML/JSON puede traer "$&" y similares.
      .replace("<!--app-head-->", () => headFor(data, url))
      .replace("<!--ssr-outlet-->", () => render(data))
      .replace("<!--ssr-data-->", () => `<script id="selkis-data" type="application/json">${safeJson(data)}</script>`);
    cache = { version, at: Date.now(), html };
    return html;
  };
}
