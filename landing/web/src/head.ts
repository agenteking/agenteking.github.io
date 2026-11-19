import { BRAND_NAME, CITY, CONTACT_EMAIL, NOINDEX, SITE_URL, WHATSAPP } from "./config";
import { FAQ, PACKAGES, SEO } from "./content";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** JSON dentro de <script>: evita cerrar el tag. */
const json = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

/** Datos estructurados: predicamos con el ejemplo (Organization + ProfessionalService + WebSite + FAQPage). */
export function structuredData() {
  const org = {
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${SITE_URL}/#org`,
    name: BRAND_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/og.png`,
    email: CONTACT_EMAIL,
    ...(WHATSAPP ? { telephone: `+${WHATSAPP}` } : {}),
    description: SEO.description,
    slogan: "Que te encuentren. Que te elijan. Que te reserven.",
    areaServed: [
      { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
      { "@type": "Country", name: "Argentina" },
    ],
    address: { "@type": "PostalAddress", addressLocality: CITY, addressRegion: "CABA", addressCountry: "AR" },
    knowsAbout: [
      "Diseño y desarrollo web",
      "Reserva de turnos online",
      "Pedidos online",
      "SEO local",
      "Google Business Profile",
      "Optimización para buscadores con IA (GEO)",
      "Datos estructurados schema.org",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Paquetes",
      itemListElement: PACKAGES.map((p) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: `${p.name}: ${p.tagline}`, description: p.features.join(". ") },
      })),
    },
  };
  const site = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: BRAND_NAME,
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#org` },
  };
  const faq = {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return { "@context": "https://schema.org", "@graph": [org, site, faq] };
}

/** <head> completo del sitio (lo inyecta scripts/prerender.mjs en el build). */
export function headTags(): string {
  const title = esc(SEO.title);
  const desc = esc(SEO.description);
  const url = `${SITE_URL}/`;
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    NOINDEX ? `<meta name="robots" content="noindex, nofollow" />` : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="es_AR" />`,
    `<meta property="og:site_name" content="${esc(BRAND_NAME)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(`${BRAND_NAME}: webs con turnos y pedidos para comercios y profesionales`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    `<meta name="twitter:image" content="${SITE_URL}/og.png" />`,
    `<script type="application/ld+json">${json(structuredData())}</script>`,
  ].join("\n    ");
}

export function sitemapXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`;
}
