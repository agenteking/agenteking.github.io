// SEO de Selkis: los datos del negocio para web/src/seo.ts (la plantilla genérica de
// crear-web-cliente/templates/seo.ts, sin cambios). NAP, nota de Google y FAQ salen de content.ts,
// lo mismo que muestra la página; servicios, precios y horarios, del catálogo (seed o base viva).
import type { PublicData } from "../../shared/types";
import { business, faqs } from "./content";
import { headTags, structuredData, type Biz } from "./seo";

export function selkisBiz(url: string): Biz {
  return {
    name: business.name,
    // Uñas es lo principal, pero también hace cejas, pestañas y láser: los dos subtipos.
    type: ["BeautySalon", "NailSalon"],
    description:
      "Salón de uñas (kapping, semipermanente, esculpidas y nail art), cejas, pestañas y depilación láser en Parque Chacabuco, CABA. Turnos online.",
    url,
    street: business.address,
    locality: "Parque Chacabuco",
    region: "CABA",
    postalCode: "C1424", // ficha de Google Maps (docs/analisis.md)
    // Pin de "Avenida Directorio 100" en OpenStreetMap (Nominatim, nodo 2428723561).
    lat: -34.6272885,
    lng: -58.4280378,
    phone: "+54 9 11 3420-8344",
    mapsUrl: business.maps,
    sameAs: [business.instagram, business.facebook],
    image: `${url}img/hero-1200.webp`,
    // Nota pública de Google Maps, la misma que se muestra en la página (hero y "Reseñas") con la fuente.
    rating: { value: Number(business.rating.replace(",", ".")), count: business.reviewsCount },
    bookingUrl: `${url}#reservar`,
    noindex: true, // demo: no se indexa (index.html lleva <meta name="robots" content="noindex">)
  };
}

/** Lo que va en <!--app-head-->: canonical, OG y JSON-LD con este catálogo. */
export const headFor = (data: PublicData, url: string) => headTags(selkisBiz(url), data, faqs);

export const jsonLdFor = (data: PublicData, url: string) => structuredData(selkisBiz(url), data, faqs);
