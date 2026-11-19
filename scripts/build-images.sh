#!/usr/bin/env bash
# Genera las variantes AVIF/WebP de assets/src/ en web/public/img/ (correr a mano cuando cambian las fuentes).
set -euo pipefail
cd "$(dirname "$0")/.."
out=web/public/img
mkdir -p "$out"
gen() { # gen <src> <name> <width...>
  local src=$1 name=$2; shift 2
  for w in "$@"; do
    magick "$src" -resize "${w}x" -strip -quality 52 "$out/$name-$w.avif"
    magick "$src" -resize "${w}x" -strip -quality 78 "$out/$name-$w.webp"
  done
}
gen assets/src/selkis-desktop.png selkis-desktop 640 820 1040 1440
gen assets/src/selkis-mobile.png  selkis-mobile 300 560
gen assets/src/selkis-booking.png selkis-booking 300 390
ls -la "$out"
