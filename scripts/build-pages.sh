#!/usr/bin/env bash
# Arma el sitio estático de GitHub Pages en _site/ (o en $OUT_DIR):
#   landing/             → /            (base "/")
#   landings/<carpeta>/  → /<carpeta>/  (base "/<carpeta>/"), una por cada carpeta con package.json
# Todo se buildea en modo demo estática (VITE_STATIC_DEMO=1): sin backend, sin /api.
# Las VITE_* de la landing (marca, contacto, precios…) se toman del entorno (ver .github/workflows/pages.yml).
#
# Uso local:  scripts/build-pages.sh            (npm ci solo si falta node_modules)
#             CI=1 scripts/build-pages.sh       (npm ci siempre, como en GitHub Actions)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT_DIR:-$ROOT/_site}"

install_deps() {
  if [[ -n "${CI:-}" || ! -d node_modules ]]; then
    npm ci --no-audit --no-fund
  fi
}

# build_web <dir del proyecto> <base pública> <destino>
build_web() {
  local dir="$1" base="$2" dest="$3"
  echo "==> ${dir#"$ROOT"/} → ${base}"
  (
    cd "$dir"
    install_deps
    # Solo el front: el build:web no necesita prisma generate ni el tsc del server.
    VITE_STATIC_DEMO=1 BASE_PATH="$base" npm run build:web
  )
  mkdir -p "$dest"
  cp -R "$dir/dist/web/." "$dest/"
}

rm -rf "$OUT"
mkdir -p "$OUT"

build_web "$ROOT/landing" "/" "$OUT"

for dir in "$ROOT"/landings/*/; do
  name="$(basename "$dir")"
  [[ -f "$dir/package.json" ]] || continue
  if [[ -e "$OUT/$name" ]]; then
    echo "ERROR: landings/$name choca con algo que ya existe en la raíz del sitio" >&2
    exit 1
  fi
  build_web "${dir%/}" "/$name/" "$OUT/$name"
done

# robots.txt en la raíz (el único que leen los buscadores). Mientras VITE_NOINDEX != 0, no se indexa nada.
if [[ "${VITE_NOINDEX:-1}" != "0" ]]; then
  printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"
  rm -f "$OUT/sitemap.xml"
else
  printf 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' "${VITE_SITE_URL:?falta VITE_SITE_URL}" > "$OUT/robots.txt"
fi

# Sin Jekyll: GitHub Pages sirve los archivos tal cual (incluidos los que empiezan con _).
touch "$OUT/.nojekyll"
echo "==> Sitio listo en $OUT"
