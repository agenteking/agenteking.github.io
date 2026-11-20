# Selkis Estudio — demo de web + turnos online

Sitio de muestra (no oficial) para presentarle a **Selkis Estudio** (Av. Directorio 100, Parque Chacabuco, CABA) una web con su marca y **reserva de turnos online**. Análisis del local y argumento de venta: [`docs/analisis.md`](docs/analisis.md).

> Datos públicos de Google Maps, Instagram y Facebook. Las fotos son ilustrativas (Unsplash), los precios son orientativos de muestra y los nombres de profesionales son de ejemplo. La página lo aclara en un banner fijo.

## Stack

| Pieza | Versión |
|---|---|
| Node | 26.13 (nvm) · npm 11.20 |
| TypeScript | 7.0.2 |
| Express | 5.3.0 + compression 1.8.2 (gzip/brotli) |
| Prisma ORM | 7.10.1 (`prisma`, `@prisma/client`, `@prisma/adapter-pg` + `pg` 8.23) · Postgres 17 de Supabase, schema `selkis` |
| Supabase | Edge Function `selkis` (Deno, Express 5 adentro) + Postgres del proyecto `vacekafvogxsvtjprfsr` (sa-east-1, plan Free) |
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
server/src/      API Express: app.ts (Node: API + SSR + estáticos), edge.ts (solo API + CORS, para Supabase),
                 api-app.ts, cors.ts, routes.ts (público), manage.ts (Gestionar mi turno), admin.ts (ABM),
                 store.ts (acceso a datos), ssr.ts (landing con datos vivos), http.ts, db.ts, index.ts
supabase/functions/selkis/  Edge Function: index.ts (importa server/src/edge.ts), env.ts, deno.json (import map)
prisma/          schema.prisma, migrations/, seed.ts   (prisma.config.ts en la raíz)
web/             front React + Vite (src/booking: reserva + gestionar; src/admin: panel; src/demo-api.ts)
scripts/         prerender.mjs (SSG del landing en el build + plantilla para el SSR)
tests/           node:test con tsx: reglas puras + API contra Postgres (schema selkis_test, se recrea en cada corrida)
pages.env        build de GitHub Pages: VITE_API_BASE (la API de Supabase; público, sin secretos)
docs/            análisis, screenshots, reportes de Lighthouse
```

## Uso

```bash
cp .env.example .env        # PORT, DATABASE_URL, TEST_DATABASE_URL, ADMIN_KEY, SITE_URL, TRUST_PROXY
npm install
npm run setup               # migraciones + prisma generate + seed (servicios, profesionales, horarios)
npm run dev                 # API :4310 (tsx watch) + Vite :5173 con proxy /api
npm run build               # prisma generate + vite build + SSR prerender + tsc del server
npm start                   # migrate deploy + Express sirve dist/web y /api en PORT (4310)
npm test                    # tests (reglas + API de punta a punta contra el schema de TEST_DATABASE_URL)
npm run lint                # oxlint
npm run typecheck           # tsc server + web
npm run db:migrate          # nueva migración en desarrollo (ver "Base de datos": sin shadow DB, usar migrate diff)
npm run db:seed             # seed NO destructivo: solo agrega lo que falta (ver "Seed")
npm run db:seed:reset       # BORRA todo (turnos incluidos) y vuelve al seed: solo desarrollo/demo
```

`npm install` con npm 11 pide aprobar scripts de instalación. Ya están en `allowScripts` del `package.json`: prisma, @prisma/engines y esbuild.

Los imports relativos llevan extensión **`.ts`** (no `.js`): así Deno (la Edge Function) los resuelve sin bundler; `tsx` y Vite los aceptan y `tsc` los reescribe a `.js` en `dist/` (`rewriteRelativeImportExtensions`). El cliente de Prisma se genera igual (`importFileExtension = "ts"`).

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

Postgres de Supabase, **un schema por cliente** dentro del mismo proyecto (el plan Free admite 2 proyectos): Selkis vive en `selkis`; los tests, en `selkis_test`. El schema sale de `?schema=` en `DATABASE_URL` (o de `DB_SCHEMA`); `server/src/db.ts` se lo pasa al adapter (`new PrismaPg(pool, { schema })`) y Prisma califica todas las tablas.

- **Conexión**: desde afuera, el pooler (Supavisor) en **modo sesión**, puerto **5432**: `postgresql://postgres.<ref>:<password>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?schema=selkis` (el host exacto: `GET https://api.supabase.com/v1/projects/<ref>/config/database/pooler`; el 6543 es modo transacción y no sirve para migrar). Las URLs de la agencia están en `data/supabase/.env` del agente (`SELKIS_DATABASE_URL`, `SELKIS_TEST_DATABASE_URL`). SSL siempre, sin validar la CA (`db.ts`).
- **Migraciones** en `prisma/migrations/` (Postgres desde el 2026-11-19; las de SQLite se reemplazaron): `…_init` (tablas) y `…_rls` (**RLS activado sin políticas** en todas las tablas y `REVOKE` a `anon`/`authenticated`: la Data API de Supabase no ve nada; además el schema no está expuesto, da `PGRST106`). Prisma y la función conectan como `postgres`, dueño de las tablas, al que RLS no le aplica. Aplicar: `DATABASE_URL=… npx prisma migrate deploy` (lo corre también `npm start`).
- **Nueva migración**: `prisma migrate dev` necesita una shadow DB; con Supabase es más simple generarla sin base: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<fecha>_<nombre>/migration.sql` y después `migrate deploy`.
- **Concurrencia**: Postgres corre transacciones en paralelo (SQLite las serializaba). Las altas y movimientos de turnos toman un lock de transacción por schema (`lockAgenda` en `store.ts`, `pg_advisory_xact_lock`) antes de chequear el horario: dos reservas simultáneas al mismo horario no pasan las dos (hay test).
- Tiempos de transacción: `maxWait` 10 s / `timeout` 20 s (desde afuera de la región cada consulta tarda 0,1-0,25 s y abrir conexión hasta ~2 s).

### El sitio lee todo de la base

Servicios, precios, categorías, el equipo ("El equipo") y la elección de profesional salen de `/api/services`; no hay precios ni nombres fijos en el front. El landing se **prerenderiza en el build con el seed** (`shared/seed-data.ts`) y ese catálogo viaja en `<script id="selkis-data">` para hidratar sin diferencias; con Express, además, **el server renderiza el landing por request con los datos vivos** (`server/src/ssr.ts`, cache invalidada con cada cambio del panel), así el HTML inicial ya trae lo cargado en el panel. En los dos casos el front después pide `/api/services` y se actualiza.

### Deploy en Supabase (Edge Function `selkis`)

La API corre en una Edge Function: **https://vacekafvogxsvtjprfsr.supabase.co/functions/v1/selkis/api/…** (p. ej. `/api/health`, `/api/services`). Es el mismo Express de `server/src` (sin SSR ni estáticos): `supabase/functions/selkis/index.ts` importa `server/src/edge.ts` y los paquetes npm salen del import map de `supabase/functions/selkis/deno.json` (mismas versiones que `package.json`; si actualizás una dependencia, actualizá las dos). Prisma corre en Deno con el runtime `wasm-compiler-edge` (el `runtime/client` de Node usa `process.pid`, que en Supabase no existe: el import map lo redirige).

```bash
# desde landings/selkis-estudio (la carpeta que tiene supabase/functions)
set -a; . <agente>/data/supabase/.env; set +a            # SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, SELKIS_*
DATABASE_URL="$SELKIS_DATABASE_URL" npx prisma migrate deploy   # migraciones al schema selkis
DATABASE_URL="$SELKIS_DATABASE_URL" npx prisma db seed          # seed no destructivo
npx prisma generate                                             # la función importa el cliente generado
npx -y supabase@latest secrets set --project-ref "$SUPABASE_PROJECT_REF" --yes "ADMIN_KEY=$SELKIS_ADMIN_KEY"
npx -y supabase@latest functions deploy selkis --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt --use-api --yes
```

- **Secrets**: `ADMIN_KEY` (la clave del panel) es un secret de Supabase; el valor está en `data/supabase/.env` del agente como `SELKIS_ADMIN_KEY`, nunca en el repo. Ojo: los secrets son **de todo el proyecto** (todas las funciones los ven); para un segundo cliente usá otro nombre o validá por función. `SUPABASE_DB_URL` (conexión directa a Postgres) la inyecta Supabase. El schema (`selkis`) y el pool (3) están fijos en `supabase/functions/selkis/env.ts`: en Supabase `process.env` es de **solo lectura** (asignarlo tira `NotSupported`).
- `--no-verify-jwt`: la API es pública (el front no manda JWT de Supabase); el panel se protege con `x-admin-key`.
- **Prefijo**: Supabase le pasa a Express la ruta con el nombre de la función (`/selkis/api/x`): `edge.ts` monta la API en `/selkis/api` y en `/api`.
- **CORS**: solo `https://agenteking.github.io` (cambiable con `CORS_ORIGINS`, separados por coma) y cualquier `http://localhost:*` / `127.0.0.1` para desarrollo (`CORS_ALLOW_LOCALHOST=0` lo apaga). Preflight `OPTIONS` → 204 con `GET, POST, PUT, DELETE, OPTIONS` y los headers `Content-Type, x-admin-key`; expone `Retry-After`. Otros orígenes no reciben `Access-Control-Allow-Origin`.
- **IP de los frenos** (en memoria, **por instancia**: se reinician con cada arranque en frío y cada instancia cuenta aparte; alcanza para una demo). Medido el 2026-11-19 con una función de prueba: el gateway de Supabase (un Worker de Cloudflare) **reescribe** `X-Forwarded-For` (`<cliente>,<cliente>, <ip del gateway>`; uno mandado por el cliente se descarta), pone `sb-forwarded-for` y `CF-Connecting-IP` con la IP real (un `CF-Connecting-IP` mandado por el cliente lo corta Cloudflare con error 1000), y adentro el socket es `0.0.0.0`. Por eso en la función `TRUST_PROXY` vale `true` por defecto y `clientIp()` usa `CF-Connecting-IP`.
- **Logs**: `GET https://api.supabase.com/v1/projects/<ref>/analytics/endpoints/logs` con `iso_timestamp_start`/`iso_timestamp_end` y `sql=SELECT timestamp, event_message FROM logs WHERE source = 'function_logs' ORDER BY timestamp DESC LIMIT 20`.
- **Latencia medida** (2026-11-19, desde Buenos Aires): arranque en frío ~3,3 s (boot + primera conexión a Postgres); en caliente 0,15-0,3 s por request.
- Probar la función en local: `cd supabase/functions/selkis && SUPABASE_DB_URL=<url sin ?schema> DB_SCHEMA=selkis_test ADMIN_KEY=… deno run -A --config deno.json index.ts` (escucha en :8000, rutas `/selkis/api/…`).

### GitHub Pages: front estático contra la API de Supabase

`scripts/build-pages.sh` (monorepo) buildea esta landing con `VITE_API_BASE` (sale de `pages.env`) en vez de `VITE_STATIC_DEMO`: el front llama a `<VITE_API_BASE>/api/…` (`web/src/api.ts`), el landing se prerenderiza con el seed y después pide los datos vivos, y el panel queda en `<base>admin/` con la clave real. A mano: `VITE_API_BASE=https://vacekafvogxsvtjprfsr.supabase.co/functions/v1/selkis BASE_PATH=/selkis-estudio/ npm run build:web`. Las demás landings siguen en demo estática.

### Demo estática (sin backend)

`VITE_STATIC_DEMO=1 BASE_PATH=/selkis-estudio/ npm run build:web` arma un sitio 100 % estático en `dist/web`: la API entera (reserva, Gestionar mi turno y el ABM del panel) se simula en el navegador (`web/src/demo-api.ts`), con el mismo seed, las mismas reglas (`shared/rules.ts`), la misma validación zod y los mismos mensajes que el server. Servicios, equipo, turnos e historial se guardan en `localStorage` (clave `selkis-demo-v2`; los turnos de la versión anterior se migran solos), compartido entre el sitio y el panel: un precio o una profesional cargados en el panel se ven en el sitio. El panel queda en `<base>admin/` y en esa demo entra con **cualquier clave no vacía**. Sin `VITE_STATIC_DEMO` todo funciona contra la API (Express en el mismo origen, o Supabase con `VITE_API_BASE`). `VITE_STATIC_DEMO=1` tiene prioridad.

Las horas se manejan en hora de Buenos Aires (UTC-3, sin horario de verano) y se guardan en UTC.

## Front

- El landing es mobile-first y se **prerenderiza en el build**: el HTML llega completo y React hidrata dentro de `startTransition`, en tramos que no bloquean el hilo principal.
- El flujo de reserva y el de **Gestionar mi turno** (Radix Dialog + Radix Themes) están **code-split**: no pesan en la carga inicial y se precargan cuando el navegador queda libre. Links directos: `/#reservar` y `/#mi-turno` (también en el menú, el hero, "Turnos online", el pie y la confirmación de la reserva).
- Imágenes AVIF/WebP responsive con `width`/`height` (CLS 0) y `loading="lazy"`. Animaciones solo con CSS, y respetan `prefers-reduced-motion`.
- Cache: `/assets/*` (con hash) usa `max-age=1y, immutable`; `index.html` usa `no-cache`. La compresión es brotli/gzip.
- Marca de la demo configurable con `VITE_DEMO_BRAND` (default "KingKanel").

## Calidad (19-11-2026, local)

**Supabase (19-11-2026, a la noche)**: `npm test` → **54/54** contra Postgres (schema `selkis_test`, se borra y se recrea en cada corrida; ~75 s porque cada consulta cruza a São Paulo): los mismos de antes adaptados + Edge Function (prefijo `/selkis/api`, CORS, IP por `CF-Connecting-IP`) + reservas simultáneas al mismo horario (sin el lock falla). Necesita `TEST_DATABASE_URL` en `.env` (tiene que terminar en `_test`). `npm run lint` y `npm run typecheck` limpios. E2E con curl contra la función viva: 21/21 (catálogo, horarios, reservar, horario tomado → 409, Gestionar mi turno: identificar/cambiar/cancelar, panel con y sin clave, historial, turno manual, borrar; preflight CORS desde github.io y rechazo de otro origen); los turnos de prueba se borraron.

Antes (SQLite): `npm test`: 50 tests (reglas puras, SEO/JSON-LD y API de punta a punta contra una SQLite temporal con las migraciones y el seed reales: frenos por IP, honeypot, tiempo mínimo, tope por clienta, freno del panel, `TRUST_PROXY`/`CF-Connecting-IP`, seed idempotente y `--reset`). Además se probó con Playwright (Chromium headless), en modo Express y en la demo estática: reservar, gestionar (identificar, cambiar servicio/día/horario, cancelar), y en el panel alta de profesional y servicio, cambio de precio, turno manual con conflicto y "Guardar igual", edición con historial, cancelar, eliminar y bajas bloqueadas; todo reflejado en el sitio y sin errores de consola. Los números de Lighthouse de abajo son de antes de estos cambios.

Hardening (19-11-2026): Playwright (Chromium headless) en Express con una base temporal — reserva normal OK, honeypot y envío en < 4 s rechazados, 429 al pasar el tope por IP (y un `X-Forwarded-For` falso no lo saltea), 5 claves malas → 429 aun con la correcta, canonical + JSON-LD presentes y el JSON-LD (también el HTML sin JS) con el precio nuevo después de cambiarlo en el panel — y en la demo estática de `scripts/build-pages.sh` (canonical de github.io, JSON-LD, reserva, honeypot, Gestionar mi turno, tope por clienta, panel y cambio de precio visible en el sitio), sin errores de consola.

Lighthouse 13.6.0 (reportes en `docs/lighthouse/`):

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile | 97 | 100 | 100 | 66* |
| Desktop | 100 | 100 | 100 | 66* |

\* SEO baja **a propósito**: la demo lleva `noindex` y `robots.txt` con `Disallow` para que no se indexe un sitio no oficial. Al pasar a producción se quitan.

Screenshots en `docs/screens/`.
