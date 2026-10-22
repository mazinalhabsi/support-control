#!/usr/bin/env bash
# Downloads the render-only inputs (not shipped with the app) into .cache/:
# CC0 HDR environments from the three.js examples (Poly Haven) and OFL fonts
# from Google Fonts, used to extrude 3D letters.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cache
HDR=https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/textures/equirectangular
for f in venice_sunset_1k.hdr quarry_01_1k.hdr; do
  [ -f ".cache/$f" ] || curl -fsSL -o ".cache/$f" "$HDR/$f"
done
font() { # $1 = css2 query, $2 = output file
  [ -f ".cache/$2" ] && return
  url=$(curl -fsSL -A 'curl/8' "https://fonts.googleapis.com/css2?family=$1" | grep -o 'https://[^)]*\.ttf' | head -1)
  curl -fsSL -o ".cache/$2" "$url"
}
font 'Bodoni+Moda:opsz,wght@96,700' bodoni-700.ttf
font 'Kufam:wght@700' kufam-700.ttf
if [ ! -f .cache/opentype.module.js ]; then
  curl -fsSL https://registry.npmjs.org/opentype.js/-/opentype.js-1.3.4.tgz | tar -xz -C .cache package/dist/opentype.module.js
  mv .cache/package/dist/opentype.module.js .cache/ && rm -rf .cache/package
fi
