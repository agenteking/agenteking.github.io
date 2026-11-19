# Agencia — monorepo

| Carpeta | Qué es |
|---|---|
| `landing/` | Nuestra landing (marca provisoria **Aparece**) |
| `landings/<cliente>/` | Una carpeta por cada landing que hacemos para un comercio (muestras y clientes) |

Cada proyecto es independiente (su `package.json`, `.env`, base SQLite). Ver el README de cada carpeta.

## GitHub Pages (https://agenteking.github.io/)

`.github/workflows/pages.yml` publica en cada push a `main` un sitio 100 % estático, armado por `scripts/build-pages.sh`:

| Ruta | Sale de |
|---|---|
| `/` | `landing/` |
| `/<carpeta>/` | cada `landings/<carpeta>/` (hoy `/selkis-estudio/`, panel en `/selkis-estudio/admin/`) |

Todo se buildea con `VITE_STATIC_DEMO=1` (sin Express ni `/api`: la landing manda el formulario por WhatsApp/mail y las demos simulan su API en el navegador) y `BASE_PATH` por carpeta. Las `VITE_*` de la landing están en el `env:` del workflow. En la raíz va un `robots.txt` con `Disallow: /` mientras `VITE_NOINDEX` no sea `0`.

Local: `scripts/build-pages.sh` (con las mismas `VITE_*` exportadas) y `python3 -m http.server -d _site 8765`.
Sin `VITE_STATIC_DEMO`, cada proyecto funciona igual que antes con Express.
