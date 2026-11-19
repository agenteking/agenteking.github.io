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
shared/          código común a server, demo estática y front: seed-data.ts (servicios, equipo, horarios),
                 rules.ts (slots, conflictos, identificación), schemas.ts (zod), messages.ts, types.ts, time.ts
server/src/      API Express: app.ts, routes.ts (público), manage.ts (Gestionar mi turno), admin.ts (ABM),
                 store.ts (acceso a datos), ssr.ts (landing con datos vivos), http.ts, db.ts, index.ts
prisma/          schema.prisma, migrations/, seed.ts   (prisma.config.ts en la raíz)
web/             front React + Vite (src/booking: reserva + gestionar; src/admin: panel; src/demo-api.ts)
scripts/         prerender.mjs (SSG del landing en el build + plantilla para el SSR)
tests/           node:test con tsx: reglas puras + API contra una SQLite temporal
data/            SQLite (gitignored)
docs/            análisis, screenshots, reportes de Lighthouse
```

## Uso

```bash
cp .env.example .env        # PORT, DATABASE_URL, ADMIN_KEY, SITE_URL, TRUST_PROXY
npm install
npm run setup               # migraciones + prisma generate + seed (servicios, profesionales, horarios)
npm run dev                 # API :4310 (tsx watch) + Vite :5173 con proxy /api
npm run build               # prisma generate + vite build + SSR prerender + tsc del server
npm start                   # migrate deploy + Express sirve dist/web y /api en PORT (4310)
npm test                    # tests (reglas + API de punta a punta contra una base temporal)
npm run lint                # oxlint
npm run typecheck           # tsc server + web
npm run db:migrate          # nueva migración en desarrollo
npm run db:seed             # seed NO destructivo: solo agrega lo que falta (ver "Seed")
npm run db:seed:reset       # BORRA todo (turnos incluidos) y vuelve al seed: solo desarrollo/demo
```

`npm install` con npm 11 pide aprobar scripts de instalación. Ya están en `allowScripts` del `package.json`: better-sqlite3, prisma, @prisma/engines y esbuild.

## API

Errores: `{ error, message, issues? }` con `message` en castellano; `issues` trae los mensajes por campo de zod.

### Público

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/services` | Catálogo del sitio: servicios activos con al menos una profesional activa, equipo activo y horarios. Sin cache (un cambio del panel se ve al toque) |
| GET | `/api/availability?serviceId&date=YYYY-MM-DD[&professionalId]` | Horarios libres según la duración del servicio, el horario del local y los turnos existentes (sin superposición). Intervalos de 30 min, al menos 60 min de anticipación, hasta 60 días adelante |
| POST | `/api/bookings` | `{serviceId, professionalId?, date, time, name, phone, email, website, fillMs}`. Sin profesional se asigna una libre. 409 `slot_unavailable` si el horario ya no está libre (chequeo y alta en una transacción). Frenos: ver abajo |

**Frenos de la reserva online** (sin captcha; los mismos mensajes en Express y en la demo):

| Freno | Cómo | Respuesta |
|---|---|---|
| Límite por IP | 8 intentos cada 15 min (cuentan todos, también los inválidos), en memoria (`server/src/rate-limit.ts`) | 429 `too_many_requests` + `Retry-After` |
| Honeypot | Campo `website` fuera de pantalla (`.bk-hp`, sin foco ni autocompletado): una persona lo deja vacío | 400 `bot_suspected`, no se guarda nada |
| Tiempo mínimo | `fillMs` = ms desde que se abrió el flujo; menos de 4 s (`MIN_FILL_MS`) o sin el dato = bot | 400 `bot_suspected` |
| Tope por clienta | Máximo 3 turnos próximos confirmados por celular (últimos 8 dígitos) **o** email (`MAX_ACTIVE_PER_CONTACT`), dentro de la transacción | 409 `too_many_bookings` ("…cambiá o cancelá uno desde Gestionar mi turno…") |

La demo estática aplica honeypot, tiempo mínimo y tope por clienta (`shared/rules.ts`); el límite por IP no tiene sentido en el navegador.

### Gestionar mi turno

La clienta se identifica con el **código de reserva** (`SLK-XXXXXX`, sin importar mayúsculas ni el prefijo) **+ el celular o el email** con el que reservó (celular: se comparan los últimos 8 dígitos, así `11 2345-6789` y `+54 9 11 2345 6789` coinciden; email sin distinguir mayúsculas). Si cualquiera de los dos no coincide la respuesta es la misma (404), y hay un freno de 20 intentos fallidos por IP cada 15 min (con la IP real: ver "IP real y proxy"). Todo va en el body (POST/PUT), así el contacto no queda en URLs ni logs. Se puede cambiar o cancelar online **hasta una hora antes**; después, por WhatsApp.

| Método | Ruta | Body | Descripción |
|---|---|---|---|
| POST | `/api/my-booking` | `{code, contact}` | Ver el turno (+ `canChange`) |
| POST | `/api/my-booking/availability` | `{code, contact, serviceId, date, professionalId?}` | Horarios libres para el cambio: mismas reglas que reservar, sin contar su propio turno |
| PUT | `/api/my-booking` | `{code, contact, serviceId, professionalId?, date, time}` | Cambiar servicio, profesional, día y horario. Sin preferencia, se queda con su profesional si está libre |
| POST | `/api/my-booking/cancel` | `{code, contact}` | Cancelar |

### Panel admin (header `x-admin-key` en todo `/api/admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/bookings?from&to&status=all\|confirmed\|cancelled&professionalId` | Turnos con filtros (fechas inclusive, hora BA) |
| GET | `/api/admin/bookings/:id` | Turno + historial (`events`) |
| POST | `/api/admin/bookings` | Carga manual `{serviceId, professionalId, date, time, name, phone?, email?, notes?, status?, force?}`. No aplica la anticipación mínima; superposición, fuera de horario, local cerrado, profesional que no hace el servicio o inactivos → 409 `conflicts` con la lista, y se guarda igual con `force: true` |
| PUT | `/api/admin/bookings/:id` | Editar (mismo body; mover día/hora/profesional/servicio, datos de la clienta, estado). Mismos conflictos |
| POST | `/api/admin/bookings/:id/cancel` | Cancelar |
| DELETE | `/api/admin/bookings/:id` | Eliminar (con su historial) |
| GET/POST | `/api/admin/services` | Listar (con turnos próximos/totales) / crear `{name, category, description, durationMin (múltiplo de 15), priceFrom, active, professionalIds?}` |
| PUT/DELETE | `/api/admin/services/:id` | Editar / eliminar |
| GET/POST | `/api/admin/professionals` | Listar / crear `{name, specialty, active, serviceIds?}` |
| PUT/DELETE | `/api/admin/professionals/:id` | Editar / eliminar |

**Bajas:** no se puede eliminar un servicio o una profesional con turnos próximos confirmados (409 `has_future_bookings`) ni con turnos en el historial (409 `has_history`, para no perderlo): el panel ofrece **desactivarlo**, que lo saca del sitio y de la reserva online. Una profesional desactivada conserva sus turnos (el panel avisa cuántos hay para reasignar).

`GET /api/bookings` y `POST /api/bookings/:id/cancel` (las rutas viejas del panel) siguen andando.

**Clave admin:** la variable `ADMIN_KEY` del `.env` (en `.env.example` viene `cambiame`: poné una propia, `openssl rand -base64 24`; el server avisa al arrancar si es la de ejemplo o corta). Se compara en tiempo constante (SHA-256 de los dos lados) y hay **freno de 5 claves incorrectas por IP cada 15 min**: después, 429 `too_many_admin_attempts` ("…Esperá 15 minutos…") aunque venga la correcta; un acierto limpia los fallos de esa IP. El panel la guarda solo en `sessionStorage` (se va al cerrar la pestaña), la borra con cualquier 401/429 y verifica la clave con un solo request en serie (un intento = un fallo). El panel está en `/admin`: pestañas **Turnos** (filtros por fechas, estado y profesional; alta manual con horarios libres sugeridos; editar con historial; cancelar; eliminar), **Servicios** y **Profesionales** (alta, edición, activar/desactivar, eliminar).

### IP real y proxy (`TRUST_PROXY`)

Los frenos son por IP. Por defecto `trust proxy` está **apagado**: la IP es la del socket y `X-Forwarded-For` se ignora (antes estaba en `true` y cualquiera rotaba la IP con ese header y salteaba los frenos).

| Cómo corre | `TRUST_PROXY` |
|---|---|
| Expuesto directo (sin proxy) | vacío (default) |
| Detrás de cloudflared / Caddy / nginx **en la misma máquina** | `loopback` |
| Detrás de N proxies en otras máquinas | `N` (saltos) o sus IPs/CIDR separadas por coma |

Con un proxy de confianza, si llega `CF-Connecting-IP` (Cloudflare) se usa esa; si no, la que resuelve Express desde `X-Forwarded-For`. Nunca `true` si el puerto es alcanzable sin pasar por el proxy (el server avisa al arrancar). Con `loopback` y el túnel, conviene además escuchar solo en `127.0.0.1`.

### SEO: canonical y JSON-LD

`<!--app-head-->` (en `web/index.html`) se completa con canonical, OG y un JSON-LD `@graph` con el negocio (`BeautySalon` + `NailSalon`: dirección, `geo` del pin de OpenStreetMap, teléfono, `openingHoursSpecification` desde los horarios, `priceRange` y `hasOfferCatalog` con los servicios y su precio "desde", `potentialAction` `ReserveAction` a `#reservar`, `aggregateRating` 4,7 / 195 = la nota pública de Google que muestra la página, con la fuente), `WebSite` y `FAQPage` (las preguntas de la página). Código: `web/src/seo.ts` (plantilla genérica de `crear-web-cliente/templates/seo.ts`) + `web/src/site-seo.ts` (los datos de Selkis, de `content.ts`).

- **URL canónica** = `SITE_URL` (origen, sin barra final) + `BASE_PATH`. En el build: `SITE_URL` o `VITE_SITE_URL`; la demo estática usa `https://agenteking.github.io` por defecto → `https://agenteking.github.io/selkis-estudio/`. En Express el SSR lee `SITE_URL` en cada render (sin ella, `http://localhost:PORT/` y avisa al arrancar).
- **Se genera de los mismos datos que la página**: en el build con el seed (prerender) y en Express por request con la base viva (`server/src/ssr.ts`), así un cambio de precio, servicio o profesional del panel cambia el JSON-LD en el próximo render (cache invalidada por el panel, o 30 s si la base cambió por fuera). En la demo estática el JSON-LD es el del seed (los cambios del panel viven en el `localStorage` de quien mira).
- Tests en `tests/seo.test.ts` (parsea el JSON-LD y chequea campos, horarios, precios, que refleje cambios y que un nombre con `</script>` no lo rompa) y en `tests/api.test.ts` (SSR con el precio cambiado, si hay build).

### Seed

`npm run db:seed` (también lo corre `npm run setup`) es **idempotente y no destructivo**: agrega solo los servicios y profesionales del seed que no existen (por id) y los horarios si la tabla está vacía. **No pisa** precios, nombres, duraciones, activo/inactivo ni quién hace qué, y no toca turnos: se puede correr contra la base de un cliente. Un servicio o profesional del seed **eliminado** desde el panel vuelve a aparecer (uno desactivado queda desactivado); un día sin horario es un día cerrado, por eso los horarios no se completan si ya hay alguno.

`npm run db:seed:reset` (`tsx prisma/seed.ts --reset`) **borra todo** (turnos, historial, servicios, profesionales, horarios) y vuelve a cargar el seed. Solo para desarrollo o la demo.

### Base de datos

Migraciones en `prisma/migrations/`. `20261119154519_abm_and_history` agrega `active`, `sortOrder`, `createdAt` y `updatedAt` a profesionales, `createdAt`/`updatedAt` a servicios, `source` (online/admin), `notes` y `updatedAt` a turnos, y la tabla `BookingEvent` (historial: alta, cambios, cancelación, quién lo hizo). Los datos existentes se conservan (`npm start` corre `prisma migrate deploy`).

### El sitio lee todo de la base

Servicios, precios, categorías, el equipo ("El equipo") y la elección de profesional salen de `/api/services`; no hay precios ni nombres fijos en el front. El landing se **prerenderiza en el build con el seed** (`shared/seed-data.ts`) y ese catálogo viaja en `<script id="selkis-data">` para hidratar sin diferencias; con Express, además, **el server renderiza el landing por request con los datos vivos** (`server/src/ssr.ts`, cache invalidada con cada cambio del panel), así el HTML inicial ya trae lo cargado en el panel. En los dos casos el front después pide `/api/services` y se actualiza.

### Demo estática (GitHub Pages)

`VITE_STATIC_DEMO=1 BASE_PATH=/selkis-estudio/ npm run build:web` arma un sitio 100 % estático en `dist/web`: la API entera (reserva, Gestionar mi turno y el ABM del panel) se simula en el navegador (`web/src/demo-api.ts`), con el mismo seed, las mismas reglas (`shared/rules.ts`), la misma validación zod y los mismos mensajes que el server. Servicios, equipo, turnos e historial se guardan en `localStorage` (clave `selkis-demo-v2`; los turnos de la versión anterior se migran solos), compartido entre el sitio y el panel: un precio o una profesional cargados en el panel se ven en el sitio. El panel queda en `<base>admin/` y en esa demo entra con **cualquier clave no vacía**. Sin `VITE_STATIC_DEMO` todo funciona contra Express.

Las horas se manejan en hora de Buenos Aires (UTC-3, sin horario de verano) y se guardan en UTC.

## Front

- El landing es mobile-first y se **prerenderiza en el build**: el HTML llega completo y React hidrata dentro de `startTransition`, en tramos que no bloquean el hilo principal.
- El flujo de reserva y el de **Gestionar mi turno** (Radix Dialog + Radix Themes) están **code-split**: no pesan en la carga inicial y se precargan cuando el navegador queda libre. Links directos: `/#reservar` y `/#mi-turno` (también en el menú, el hero, "Turnos online", el pie y la confirmación de la reserva).
- Imágenes AVIF/WebP responsive con `width`/`height` (CLS 0) y `loading="lazy"`. Animaciones solo con CSS, y respetan `prefers-reduced-motion`.
- Cache: `/assets/*` (con hash) usa `max-age=1y, immutable`; `index.html` usa `no-cache`. La compresión es brotli/gzip.
- Marca de la demo configurable con `VITE_DEMO_BRAND` (default "KingKanel").

## Calidad (19-11-2026, local)

`npm test`: 50 tests (reglas puras, SEO/JSON-LD y API de punta a punta contra una SQLite temporal con las migraciones y el seed reales: frenos por IP, honeypot, tiempo mínimo, tope por clienta, freno del panel, `TRUST_PROXY`/`CF-Connecting-IP`, seed idempotente y `--reset`). Además se probó con Playwright (Chromium headless), en modo Express y en la demo estática: reservar, gestionar (identificar, cambiar servicio/día/horario, cancelar), y en el panel alta de profesional y servicio, cambio de precio, turno manual con conflicto y "Guardar igual", edición con historial, cancelar, eliminar y bajas bloqueadas; todo reflejado en el sitio y sin errores de consola. Los números de Lighthouse de abajo son de antes de estos cambios.

Hardening (19-11-2026): Playwright (Chromium headless) en Express con una base temporal — reserva normal OK, honeypot y envío en < 4 s rechazados, 429 al pasar el tope por IP (y un `X-Forwarded-For` falso no lo saltea), 5 claves malas → 429 aun con la correcta, canonical + JSON-LD presentes y el JSON-LD (también el HTML sin JS) con el precio nuevo después de cambiarlo en el panel — y en la demo estática de `scripts/build-pages.sh` (canonical de github.io, JSON-LD, reserva, honeypot, Gestionar mi turno, tope por clienta, panel y cambio de precio visible en el sitio), sin errores de consola.

Lighthouse 13.6.0 (reportes en `docs/lighthouse/`):

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile | 97 | 100 | 100 | 66* |
| Desktop | 100 | 100 | 100 | 66* |

\* SEO baja **a propósito**: la demo lleva `noindex` y `robots.txt` con `Disallow` para que no se indexe un sitio no oficial. Al pasar a producción se quitan.

Screenshots en `docs/screens/`.
