# Selkis Estudio — demo de web + turnos online

Sitio de muestra (no oficial) para presentarle a **Selkis Estudio** (Av. Directorio 100, Parque Chacabuco, CABA) una web con su marca y **reserva de turnos online**. Análisis del local y argumento de venta: [`docs/analisis.md`](docs/analisis.md).

> Datos públicos de Google Maps, Instagram y Facebook. Las fotos son ilustrativas (Unsplash), los precios son orientativos de muestra y los nombres de profesionales son de ejemplo. La página lo aclara en un banner fijo.

## Stack

| Pieza | Versión |
|---|---|
| Node | 26.13 (nvm) · npm 11.20 |
| TypeScript | 7.0.2 |
| Express | 5.3.0 + compression 1.8.2 (gzip/brotli) |
| Prisma ORM | 7.10.1 (`prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3`) · SQLite en `data/selkis.db` |
| zod | 4.6.7 |
| React / React DOM | 19.3.1 |
| Vite | 8.3.8 + `@vitejs/plugin-react` 6.3.0 |
| Radix UI | Themes 3.3.0 (flujo de reserva y admin) · primitives Dialog 1.3.1 y Accordion 1.3.1 |
| Fuentes | Fraunces + Manrope (variable, self-hosted vía @fontsource-variable 5.3.0, `font-display: swap`) |
| oxlint | 1.94.0 |
| tsx | 4.23.15 · concurrently 10.0.7 |

Nota sobre Prisma: el dist-tag `latest` del CLI `prisma` apunta hoy a `8.0.0-rc.34`, una release candidate, mientras que el de `@prisma/client` y el del adapter apuntan a 7.10.1. Como CLI y cliente tienen que ir en la misma versión, se usa **7.10.1**, la última estable de los tres.

## Estructura

```
server/src/      API Express (index.ts, routes.ts, availability.ts, db.ts, time.ts)
prisma/          schema.prisma, migrations/, seed.ts   (prisma.config.ts en la raíz)
web/             front React + Vite (index.html, src/, public/img con AVIF/WebP)
scripts/         prerender.mjs (SSG del landing en el build)
data/            SQLite (gitignored)
docs/            análisis, screenshots, reportes de Lighthouse
```

## Uso

```bash
cp .env.example .env        # PORT, DATABASE_URL, ADMIN_KEY
npm install
npm run setup               # migraciones + prisma generate + seed (servicios, profesionales, horarios)
npm run dev                 # API :4310 (tsx watch) + Vite :5173 con proxy /api
npm run build               # prisma generate + vite build + SSR prerender + tsc del server
npm start                   # migrate deploy + Express sirve dist/web y /api en PORT (4310)
npm run lint                # oxlint
npm run typecheck           # tsc server + web
npm run db:migrate          # nueva migración en desarrollo
npm run db:seed             # re-seed (idempotente)
```

`npm install` con npm 11 pide aprobar scripts de instalación. Ya están en `allowScripts` del `package.json`: better-sqlite3, prisma, @prisma/engines y esbuild.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/services` | Servicios activos (con profesionales) y horarios del local |
| GET | `/api/availability?serviceId&date=YYYY-MM-DD[&professionalId]` | Horarios libres según la duración del servicio, el horario del local y los turnos existentes (sin superposición). Intervalos de 30 min, al menos 60 min de anticipación, hasta 60 días adelante |
| POST | `/api/bookings` | `{serviceId, professionalId?, date, time, name, phone, email}`, validado con zod. Si no se elige profesional, se asigna uno libre. Responde 409 si el horario ya no está libre (el chequeo y el alta van en una transacción) |
| GET | `/api/bookings?status=all\|confirmed\|cancelled&from=YYYY-MM-DD` | **Admin**: header `x-admin-key` |
| POST | `/api/bookings/:id/cancel` | **Admin**: cancela y libera el horario |

**Clave admin de demo: `selkis-demo-2026`.** Es el default de `ADMIN_KEY` en `.env`; cambiala en producción. El panel está en `/admin`.

Las horas se manejan en hora de Buenos Aires (UTC-3, sin horario de verano) y se guardan en UTC.

## Front

- El landing es mobile-first y se **prerenderiza en el build**: el HTML llega completo y React hidrata dentro de `startTransition`, en tramos que no bloquean el hilo principal.
- El flujo de reserva (Radix Dialog + Radix Themes) está **code-split**: no pesa en la carga inicial y se precarga cuando el navegador queda libre. Link directo: `/#reservar`.
- Imágenes AVIF/WebP responsive con `width`/`height` (CLS 0) y `loading="lazy"`. Animaciones solo con CSS, y respetan `prefers-reduced-motion`.
- Cache: `/assets/*` (con hash) usa `max-age=1y, immutable`; `index.html` usa `no-cache`. La compresión es brotli/gzip.
- Marca de la demo configurable con `VITE_DEMO_BRAND` (default "KingKanel").

## Calidad (19-11-2026, local)

Lighthouse 13.6.0 (reportes en `docs/lighthouse/`):

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile | 97 | 100 | 100 | 66* |
| Desktop | 100 | 100 | 100 | 66* |

\* SEO baja **a propósito**: la demo lleva `noindex` y `robots.txt` con `Disallow` para que no se indexe un sitio no oficial. Al pasar a producción se quitan.

Screenshots en `docs/screens/`.
