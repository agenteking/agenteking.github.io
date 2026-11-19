// Plantilla de SEO + GEO para la web de un cliente: canonical + OG + JSON-LD LocalBusiness generado
// desde los MISMOS datos que muestra la página (servicios, precios, horarios), así un cambio del panel
// también cambia el JSON-LD. Implementación de referencia: Selkis (landings/selkis-estudio):
//   web/src/seo.ts       = este archivo, sin cambios (genérico)
//   web/src/site-seo.ts  = los datos del negocio (Biz) + headFor(data, url), con NAP de content.ts y FAQ
//   web/src/entry-server.tsx exporta headFor y canonicalUrl
//   web/index.html       lleva <!--app-head--> en el <head> (title/description/robots quedan ahí, fijos)
//   scripts/prerender.mjs reemplaza <!--app-head--> con el seed (build) y deja el marcador en dist/ssr/template.html
//   server/src/ssr.ts    lo reemplaza por request con los datos vivos de la base (cache invalidada por el panel)
// Patrón original (sin turnos): landing/web/src/head.ts (Organization + ProfessionalService + WebSite + FAQPage).
//
// Reglas (GEO = que un asistente de IA pueda citar al negocio):
// - Todo lo que va en el JSON-LD también se ve en la página, con las mismas palabras y números.
// - NAP idéntico (nombre, dirección, teléfono) al de la ficha de Google, Instagram y el pie del sitio.
// - `rating` (aggregateRating) SOLO si es la nota pública real de Google y la página la muestra igual,
//   con la fuente. Google no la usa para rich results de LocalBusiness ("self-serving"), pero sí la leen
//   otros buscadores y asistentes. Nunca reseñas propias ni inventadas.
// - Sin geo inventado: coordenadas del pin real (Google Maps / OpenStreetMap).
// - Este archivo no importa nada con import.meta.env: lo usan el build (prerender), el server y los tests (tsx).
import type { BusinessHour, PublicData } from "../../shared/types";

export interface Biz {
  name: string;
  /** Subtipo(s) de schema.org más preciso(s): BeautySalon, NailSalon, HairSalon, DaySpa,
   *  HealthAndBeautyBusiness, VeterinaryCare, Dentist, Physiotherapy, MedicalClinic, ExerciseGym,
   *  Restaurant, Bakery, Store… Varios: ["BeautySalon", "NailSalon"]. */
  type: string | string[];
  description: string;
  /** URL canónica con barra final (ver canonicalUrl): https://dominio.com.ar/ o https://agenteking.github.io/<slug>/ */
  url: string;
  street: string; // "Av. Directorio 100"
  locality: string; // "Parque Chacabuco" (barrio)
  region: string; // "CABA"
  postalCode: string; // "C1424"
  lat?: number;
  lng?: number;
  phone: string; // internacional: "+54 9 11 3420-8344"
  email?: string;
  mapsUrl: string;
  sameAs: string[]; // Instagram, Facebook, ficha de Google (CID) …
  /** "$$" o un rango; si falta se arma con el precio "desde" más bajo y más alto del catálogo. */
  priceRange?: string;
  /** Foto del local (URL absoluta) para el JSON-LD. */
  image?: string;
  /** og:image 1200×630 (URL absoluta). Sin ella no se emiten og:image ni twitter:card grande. */
  ogImage?: string;
  /** Nota pública de Google (ver reglas arriba). */
  rating?: { value: number; count: number };
  /** Reserva online (Standard/Pro): URL del flujo. Sin esto no va potentialAction (Light). */
  bookingUrl?: string;
  noindex: boolean; // true mientras sea demo
}

export interface Faq {
  q: string;
  a: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** JSON seguro dentro de <script> (sin "</script>" ni "<!--"). */
export const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * URL canónica = origen del sitio (SITE_URL, sin barra final) + base pública (BASE_PATH de Vite).
 * canonicalUrl("https://agenteking.github.io/", "/selkis-estudio/") → "https://agenteking.github.io/selkis-estudio/"
 */
export function canonicalUrl(siteUrl: string, basePath = "/") {
  const origin = siteUrl.trim().replace(/\/+$/, "");
  const base = `/${basePath.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
  return `${origin}${base}`;
}

/** Horarios agrupados: los días con el mismo horario van en una sola especificación. */
export function openingHours(hours: BusinessHour[]) {
  const groups = new Map<string, number[]>();
  for (const h of [...hours].sort((a, b) => a.weekday - b.weekday)) {
    const k = `${h.open}-${h.close}`;
    groups.set(k, [...(groups.get(k) ?? []), h.weekday]);
  }
  return [...groups].map(([k, days]) => {
    const [opens, closes] = k.split("-");
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days.map((d) => `https://schema.org/${DAYS[d]}`),
      opens,
      closes,
    };
  });
}

const ars = (n: number) => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export function priceRangeOf(data: PublicData) {
  const prices = data.services.map((s) => s.priceFrom).filter((n) => n > 0);
  if (!prices.length) return undefined;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? `Desde ${ars(lo)}` : `${ars(lo)} – ${ars(hi)}`;
}

export function structuredData(biz: Biz, data: PublicData, faqs: Faq[] = []) {
  const priceRange = biz.priceRange ?? priceRangeOf(data);
  const business = {
    "@type": biz.type,
    "@id": `${biz.url}#negocio`,
    name: biz.name,
    description: biz.description,
    url: biz.url,
    ...(biz.image ? { image: biz.image } : {}),
    telephone: biz.phone,
    ...(biz.email ? { email: biz.email } : {}),
    ...(priceRange ? { priceRange } : {}),
    currenciesAccepted: "ARS",
    address: {
      "@type": "PostalAddress",
      streetAddress: biz.street,
      addressLocality: biz.locality,
      addressRegion: biz.region,
      postalCode: biz.postalCode,
      addressCountry: "AR",
    },
    ...(biz.lat != null && biz.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: biz.lat, longitude: biz.lng } } : {}),
    hasMap: biz.mapsUrl,
    sameAs: biz.sameAs,
    openingHoursSpecification: openingHours(data.hours),
    // Servicios con precio "desde" (salen de la base: lo que cambia el panel cambia acá en el próximo render).
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Servicios",
      itemListElement: data.services.map((s) => ({
        "@type": "Offer",
        price: s.priceFrom,
        priceCurrency: "ARS",
        priceSpecification: { "@type": "PriceSpecification", minPrice: s.priceFrom, priceCurrency: "ARS" },
        itemOffered: {
          "@type": "Service",
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
          category: s.category,
        },
      })),
    },
    ...(biz.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: biz.rating.value,
            reviewCount: biz.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(biz.bookingUrl
      ? {
          potentialAction: {
            "@type": "ReserveAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: biz.bookingUrl,
              inLanguage: "es-AR",
              actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"],
            },
            result: { "@type": "Reservation", name: "Turno" },
          },
        }
      : {}),
  };
  const site = {
    "@type": "WebSite",
    "@id": `${biz.url}#web`,
    url: biz.url,
    name: biz.name,
    inLanguage: "es-AR",
    publisher: { "@id": `${biz.url}#negocio` },
  };
  const graph: unknown[] = [business, site];
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${biz.url}#faq`,
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Tags del <head> que dependen de la URL y de los datos. Con `seo` también title/description/robots/og
 * (si no, quedan fijos en index.html). Título ≤ 60 caracteres ("Negocio · qué hace en Barrio"),
 * description ≤ 155 con la acción.
 */
export function headTags(biz: Biz, data: PublicData, faqs: Faq[] = [], seo?: { title: string; description: string }) {
  const tags: string[] = [];
  if (seo) {
    const t = esc(seo.title);
    const d = esc(seo.description);
    tags.push(
      `<title>${t}</title>`,
      `<meta name="description" content="${d}" />`,
      biz.noindex
        ? `<meta name="robots" content="noindex, nofollow" />`
        : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      `<meta property="og:title" content="${t}" />`,
      `<meta property="og:description" content="${d}" />`,
    );
  }
  tags.push(
    `<link rel="canonical" href="${esc(biz.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="es_AR" />`,
    `<meta property="og:site_name" content="${esc(biz.name)}" />`,
    `<meta property="og:url" content="${esc(biz.url)}" />`,
  );
  if (biz.ogImage) {
    tags.push(
      `<meta property="og:image" content="${esc(biz.ogImage)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    );
  }
  tags.push(`<script type="application/ld+json">${jsonForScript(structuredData(biz, data, faqs))}</script>`);
  return tags.join("\n    ");
}

export function sitemapXml(biz: Biz) {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(biz.url)}</loc><lastmod>${today}</lastmod></url>
</urlset>
`;
}
