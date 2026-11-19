# Landing de la agencia (marca provisoria: **Aparece**)

Landing propia de la agencia: webs premium con turnos y pedidos para comercios y profesionales de barrio.
Es el primer ejemplo de lo que vendemos, así que predica con el ejemplo: rápida, accesible, con SEO local
y datos estructurados para buscadores con IA (GEO).

> **Honestidad.** No hay testimonios, métricas de clientes, logos de clientes ni cifras inventadas. La única
> web que se muestra es la demo de Selkis, marcada como "concepto / demo sin encargo, no es un cliente". Los
> mockups del buscador y del asistente de IA usan negocios ficticios y lo dicen. No hay fotos de personas.
> La experiencia del equipo se menciona como "trayectoria en la industria, en empresas como Facebook y
> Microsoft", sin cargos, años, nombres ni logos.

## Cambiar la marca (un solo lugar)

Todo sale de variables `VITE_*` en `.env` (ver `.env.example`), leídas por `web/src/config.ts`:

| Variable | Para qué |
|---|---|
| `VITE_BRAND_NAME` | Nombre en el sitio, títulos, OG, schema.org y footer |
| `VITE_SITE_URL`, `VITE_CONTACT_EMAIL` | URL canónica / sitemap / JSON-LD y mail de contacto |
| `VITE_WHATSAPP` | Número internacional sin `+` (vacío = se ocultan los botones de WhatsApp) |
| `VITE_NOINDEX` | `1` = `<meta robots noindex>` (demo). `0` al publicar |
| `VITE_SHOW_PRICES` | `1` = muestra precios "desde" orientativos en los paquetes |
| `VITE_DEMO_URL` | Link opcional "Ver la demo andando" en el caso de ejemplo |
| `NOINDEX` (runtime) | `1` = `X-Robots-Tag: noindex` + `robots.txt` con `Disallow: /`. `0` al publicar (robots con `Sitemap:`) |

Después de cambiar algo: `npm run build` y reiniciar. Para regenerar la imagen OG con el nombre nuevo:
`npm i --no-save puppeteer && node scripts/render-og.mjs` (con `CHROME=/ruta/a/chrome` si hace falta).
El isotipo (pin + destello) está en `web/src/components/Icons.tsx` (`LogoMark`) y `web/public/favicon.svg`.

### Para publicar de verdad
`VITE_NOINDEX=0`, `NOINDEX=0`, `VITE_SITE_URL` con el dominio real, WhatsApp y mail reales, `ADMIN_KEY` propia, `npm run build`.

**Ojo con Cloudflare (importa para GEO):** detrás de Cloudflare (incluido el quick tunnel de la demo) el `robots.txt`
llega con un bloque "Cloudflare Managed Content" antepuesto que **bloquea a los crawlers de IA** (GPTBot,
OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, etc.). Si la web propia, o la de un cliente, va por
Cloudflare, hay que desactivar "Manage robots.txt" / AI Crawl Control en el panel, o se pierde justo lo que vendemos.

## Nombres propuestos (dominio .com.ar consultado en whois.nic.ar el 19-11-2026: **no registrados**)

| # | Nombre | Dominio | Por qué |
|---|---|---|---|
| 1 ★ | **Aparece** | `aparece.com.ar` | Es la promesa en una palabra ("tu negocio aparece": en Google, en la IA, en el barrio). Corto, en castellano, dominio de una sola palabra libre. **Elegido como provisorio.** |
| 2 | Marquesina Studio | `marquesinastudio.com.ar` | La marquesina es el cartel iluminado sobre la vidriera: visibilidad de comercio de barrio, con aire premium |
| 3 | Cuadra Studio | `cuadrastudio.com.ar` | "La cuadra": lo local, lo cercano. Suena a estudio de diseño |
| 4 | Alumbre | `alumbre.com.ar` | Iluminar, poner a la vista. Palabra propia, fácil de registrar como marca |
| 5 | Vecino Studio | `vecinostudio.com.ar` | Tono de vecinos que hacen algo útil (el que propone la estrategia de ventas) |

Descartados por estar registrados: marquesina, farol, cuadra, mostrador, vidrieradigital, lucero, lumbre, nitido,
barriodigital, alcance, faro, umbralstudio. Antes de decidir: chequear @ en Instagram y registro de marca en INPI.

## Paquetes: sin precio por defecto (decisión)

Los paquetes (Tranqui → Turnos ★ → Vidriera, el más completo primero por anclaje) se muestran **sin precio y con
"Consultar precio"**, y la página promete "precio cerrado, por escrito, en la primera charla". Por qué:
1. Los precios de `references/oferta-y-precios.md` son una **propuesta a validar por los socios**; publicar un
   número no confirmado es peor que no publicarlo.
2. El posicionamiento es premium: el precio se ancla en la charla contra el costo de no tener web, no contra
   un SaaS de $8k por mes que el visitante compara en frío.
3. El diferencial ("te mostramos tu web antes de pagar") ya baja el riesgo percibido; el CTA a consulta lleva a eso.

La skill de ventas prefiere precio "desde" (los comercios odian el "consultar"): por eso queda a un flag.
`VITE_SHOW_PRICES=1` muestra los "desde" (setup + abono) con la aclaración de que son orientativos.
Los valores están en `web/src/content.ts` (`PACKAGES`).

## Stack (igual que la demo de Selkis, todo latest estable al 19-11-2026)

| Pieza | Versión |
|---|---|
| Node | 26.13 (nvm) · npm 11.20 |
| TypeScript | 7.0.2 |
| React / React DOM | 19.3.1 · Vite 8.3.8 + `@vitejs/plugin-react` 6.3.0 |
| Radix | Accordion 1.3.1 (FAQ) · Dialog 1.3.1 (menú del celu, cargado a demanda) |
| Express | 5.3.0 + compression 1.8.2 (brotli/gzip) |
| Prisma | 7.10.1 + `@prisma/adapter-better-sqlite3` (SQLite en `data/agencia.db`) |
| zod | 4.6.7 (mismo esquema en server y front, el front lo carga diferido) |
| Fuentes | Geist (variable) + Instrument Serif italic, self-hosted vía Fontsource 5.3.0 |
| oxlint | 1.94.0 · tsx 4.23.15 · concurrently 10.0.7 |

Prisma: el dist-tag `latest` del CLI apunta a `8.0.0-rc.34` (release candidate) y el del cliente a 7.10.1; CLI y
cliente van en la misma versión, así que se usa 7.10.1, la última estable de los tres (igual que en Selkis).

## Estructura

```
server/src/      Express: index.ts (estáticos, cache, robots, noindex), routes.ts (API), contact-schema.ts (zod), db.ts
prisma/          schema.prisma (modelo Lead) + migrations/   (prisma.config.ts en la raíz)
web/             index.html, src/ (App.tsx, content.ts = todo el copy, config.ts = marca, head.ts = SEO/JSON-LD), public/
scripts/         prerender.mjs (SSG + head + CSS inline + sitemap), build-images.sh (AVIF/WebP), render-og.mjs + og/
assets/src/      capturas originales de la demo (fuente de web/public/img)
docs/            screens/ y lighthouse/
```

## Uso

```bash
cp .env.example .env
npm install
npm run setup        # migraciones + prisma generate
npm run dev          # API :4320 (tsx watch) + Vite :5174 con proxy /api
npm run build        # prisma generate + vite build + prerender SSR + tsc del server
npm start            # migrate deploy + Express sirve dist/web y /api en PORT (4320)
npm run lint         # oxlint
npm run typecheck    # tsc server + web
npm run images       # regenera AVIF/WebP desde assets/src (ImageMagick)
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/contact` | `{name, business, rubro?, barrio?, phone?, email?, message?, plan?}` validado con zod (WhatsApp o email obligatorio). Honeypot `website`. Límite: 5 envíos cada 10 min por IP. Guarda en SQLite (`Lead`) |
| GET | `/api/contacts` | **Admin**: últimas 200 consultas. Header `x-admin-key: $ADMIN_KEY` |
| GET | `/api/health` | `{ok: true}` |

Ejemplo: `curl -H "x-admin-key: $ADMIN_KEY" http://localhost:4320/api/contacts`

## SEO / GEO de la propia landing

- `<title>`, description, canonical, Open Graph + Twitter con `og.png` 1200×630.
- JSON-LD `@graph`: `Organization` + `ProfessionalService` (área CABA/Argentina, `knowsAbout`, catálogo de
  paquetes), `WebSite` y `FAQPage` con las 10 preguntas. Las respuestas del FAQ también están en el HTML.
- `sitemap.xml` generado en el build; `robots.txt` lo sirve Express según `NOINDEX`.
- Mientras es demo: `noindex` en meta + header + robots (por eso Lighthouse SEO da 69; con `NOINDEX=0` sube).

## Rendimiento

- HTML prerenderizado (SSG) con el CSS inline; React hidrata en una transición.
- Imágenes AVIF/WebP responsive con `width`/`height` (CLS ≈ 0), preload de la del hero, `lazy` el resto.
- `content-visibility: auto` en las secciones de abajo del pliegue; zod y el menú del celu en chunks aparte.
- Cache: `/assets/*` 1 año `immutable`; imágenes 7 días; `index.html` `no-cache`. Brotli/gzip.
- Animaciones solo CSS (scroll-driven `animation-timeline: view()` donde hay soporte); todo se apaga con
  `prefers-reduced-motion` (el carrusel de búsquedas pasa a una grilla estática).

## Calidad (19-11-2026, local, Lighthouse 13.6.0; reportes en `docs/lighthouse/`)

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile | 99 | 100 | 100 | 69* |
| Desktop | 100 | 100 | 100 | 69* |

\* SEO baja **a propósito** por el `noindex` de demo.

Screenshots en `docs/screens/` (390×844 y 1440×900, más la página completa en desktop).

## Imágenes

No se usó Gemini (no había herramientas de navegador disponibles en la sesión, y no se inició sesión con
ninguna cuenta). Los visuales son por código: marcos de navegador y celular con las capturas reales de la
demo de Selkis, y mockups en HTML/CSS de un resultado de búsqueda local y de un asistente de IA.
