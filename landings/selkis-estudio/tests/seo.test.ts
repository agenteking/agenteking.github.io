// SEO/GEO: canonical + JSON-LD generados desde el catálogo (web/src/seo.ts + web/src/site-seo.ts).
// Mismo código que usan el prerender (build, con el seed) y el SSR de Express (con la base viva).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seedPublicData } from "../shared/seed-data.ts";
import { MIN_FILL_MS, activeForContact, looksLikeBot } from "../shared/rules.ts";
import { localToDate } from "../shared/time.ts";
import type { PublicData } from "../shared/types.ts";
import { business, faqs } from "../web/src/content.ts";
import { canonicalUrl, openingHours, priceRangeOf } from "../web/src/seo.ts";
import { headFor, jsonLdFor } from "../web/src/site-seo.ts";

const URL_ = "https://agenteking.github.io/selkis-estudio/";

/** El JSON-LD tal como queda en el HTML (parseado del <script>). */
function ldFromHead(head: string) {
  const m = head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.ok(m, "falta el <script type=application/ld+json>");
  return JSON.parse(m[1]!) as { "@context": string; "@graph": Record<string, any>[] };
}

const bizOf = (ld: ReturnType<typeof ldFromHead>) => ld["@graph"].find((n) => n["@id"]?.endsWith("#negocio"))!;

describe("canonical", () => {
  it("SITE_URL + BASE_PATH, con barra final", () => {
    assert.equal(canonicalUrl("https://agenteking.github.io", "/selkis-estudio/"), URL_);
    assert.equal(canonicalUrl("https://agenteking.github.io/", "selkis-estudio"), URL_);
    assert.equal(canonicalUrl("https://selkis.com.ar"), "https://selkis.com.ar/");
    assert.equal(canonicalUrl("http://localhost:4310/", "/"), "http://localhost:4310/");
  });

  it("va en el head junto con og:url", () => {
    const head = headFor(seedPublicData(), URL_);
    assert.ok(head.includes(`<link rel="canonical" href="${URL_}" />`));
    assert.ok(head.includes(`<meta property="og:url" content="${URL_}" />`));
  });
});

describe("JSON-LD", () => {
  const data = seedPublicData();
  const ld = ldFromHead(headFor(data, URL_));
  const biz = bizOf(ld);

  it("es JSON válido de schema.org con negocio, sitio y FAQ", () => {
    assert.equal(ld["@context"], "https://schema.org");
    assert.deepEqual(biz["@type"], ["BeautySalon", "NailSalon"]);
    assert.ok(ld["@graph"].some((n) => n["@type"] === "WebSite" && n.url === URL_));
    const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage")!;
    assert.equal(faq.mainEntity.length, faqs.length);
    assert.equal(faq.mainEntity[0].acceptedAnswer["@type"], "Answer");
  });

  it("campos requeridos del LocalBusiness: nombre, dirección, geo, teléfono, url", () => {
    assert.equal(biz.name, "Selkis Estudio");
    assert.equal(biz.url, URL_);
    assert.equal(biz.telephone, "+54 9 11 3420-8344");
    assert.deepEqual(biz.address, {
      "@type": "PostalAddress",
      streetAddress: "Av. Directorio 100",
      addressLocality: "Parque Chacabuco",
      addressRegion: "CABA",
      postalCode: "C1424",
      addressCountry: "AR",
    });
    assert.equal(biz.geo["@type"], "GeoCoordinates");
    assert.ok(Math.abs(biz.geo.latitude + 34.627) < 0.01 && Math.abs(biz.geo.longitude + 58.428) < 0.01);
    assert.ok(biz.image.startsWith(URL_));
    assert.ok(biz.sameAs.includes(business.instagram));
  });

  it("horarios desde los datos (lunes 13–19, mar–vie 9–19, sáb 9–18), agrupados", () => {
    const spec = biz.openingHoursSpecification as { dayOfWeek: string[]; opens: string; closes: string }[];
    const byDay = new Map(spec.flatMap((s) => s.dayOfWeek.map((d) => [d.replace("https://schema.org/", ""), `${s.opens}-${s.closes}`])));
    assert.equal(byDay.get("Monday"), "13:00-19:00");
    assert.equal(byDay.get("Thursday"), "09:00-19:00");
    assert.equal(byDay.get("Saturday"), "09:00-18:00");
    assert.equal(byDay.has("Sunday"), false);
    assert.equal(spec.length, 3);
    assert.deepEqual(openingHours([]), []);
  });

  it("servicios con precio en hasOfferCatalog y priceRange del catálogo", () => {
    const offers = biz.hasOfferCatalog.itemListElement as Record<string, any>[];
    assert.equal(offers.length, data.services.length);
    for (const o of offers) {
      const s = data.services.find((x) => x.name === o.itemOffered.name)!;
      assert.equal(o.price, s.priceFrom);
      assert.equal(o.priceCurrency, "ARS");
      assert.equal(o.priceSpecification.minPrice, s.priceFrom);
    }
    assert.equal(biz.priceRange, "$12.000 – $38.000");
  });

  it("ReserveAction a #reservar y la nota pública de Google (la misma que muestra la página)", () => {
    assert.equal(biz.potentialAction["@type"], "ReserveAction");
    assert.equal(biz.potentialAction.target.urlTemplate, `${URL_}#reservar`);
    assert.deepEqual(
      { v: biz.aggregateRating.ratingValue, n: biz.aggregateRating.reviewCount },
      { v: 4.7, n: business.reviewsCount },
    );
  });

  it("refleja un cambio de precio, de horario o una baja (los mismos datos que el panel)", () => {
    const edited: PublicData = {
      ...data,
      services: data.services
        .filter((s) => s.id !== "laser-piernas")
        .map((s) => (s.id === "kapping-gel" ? { ...s, priceFrom: 26500 } : s)),
      hours: data.hours.map((h) => (h.weekday === 6 ? { ...h, close: "14:00" } : h)),
    };
    const b = bizOf(ldFromHead(headFor(edited, URL_)));
    const offers = b.hasOfferCatalog.itemListElement as Record<string, any>[];
    assert.equal(offers.find((o) => o.itemOffered.name === "Kapping gel")!.price, 26500);
    assert.equal(offers.length, data.services.length - 1);
    assert.equal(b.priceRange, "$12.000 – $32.000");
    assert.ok(b.openingHoursSpecification.some((s: { closes: string; dayOfWeek: string[] }) => s.closes === "14:00"));
  });

  it("no se puede romper el <script> con un nombre cargado en el panel", () => {
    const evil: PublicData = { ...data, services: [{ ...data.services[0]!, name: "</script><script>alert(1)</script>" }] };
    const head = headFor(evil, URL_);
    assert.equal(head.match(/<\/script>/g)!.length, 1);
    assert.equal(bizOf(ldFromHead(head)).hasOfferCatalog.itemListElement[0].itemOffered.name, "</script><script>alert(1)</script>");
  });

  it("jsonLdFor da lo mismo que lo que va en el head", () => {
    assert.deepEqual(jsonLdFor(data, URL_), ld);
    assert.equal(priceRangeOf({ ...data, services: [] }), undefined);
  });
});

describe("anti-bots y tope por contacto (reglas compartidas con la demo)", () => {
  it("looksLikeBot: honeypot o llenado muy rápido", () => {
    assert.equal(looksLikeBot({ website: "", fillMs: 30_000 }), false);
    assert.equal(looksLikeBot({ website: "x", fillMs: 30_000 }), true);
    assert.equal(looksLikeBot({ fillMs: MIN_FILL_MS - 1 }), true);
  });

  it("activeForContact: solo próximos y confirmados, por celular (últimos 8) o email", () => {
    const now = localToDate("2026-12-01", "10:00");
    const b = (date: string, status = "confirmed", phone = "1144445555", email = "a@x.com") => ({
      start: localToDate(date, "11:00"),
      status,
      customerPhone: phone,
      customerEmail: email,
    });
    const list = [b("2026-12-02"), b("2026-11-30"), b("2026-12-03", "cancelled"), b("2026-12-04", "confirmed", "1199990000", "A@X.com"), b("2026-12-05", "confirmed", "+5491144445555", "")];
    assert.equal(activeForContact(list, { phone: "11 4444-5555", email: "otra@x.com" }, now), 2);
    assert.equal(activeForContact(list, { phone: "1100000000", email: "a@x.com" }, now), 2);
    assert.equal(activeForContact(list, { phone: "1100000000", email: "" }, now), 0);
  });
});
