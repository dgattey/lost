#!/usr/bin/env bash
# Regenerate raster favicons from public/favicon.svg (requires network for pnpm dlx).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/public/favicon.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pnpm dlx sharp-cli --input "$SVG" --output "$TMP/f16.png" resize 16
pnpm dlx sharp-cli --input "$SVG" --output "$TMP/f32.png" resize 32
pnpm dlx png-to-ico "$TMP/f16.png" "$TMP/f32.png" > "$ROOT/public/favicon.ico"

pnpm dlx sharp-cli --input "$SVG" --output "$ROOT/public/apple-touch-icon.png" resize 180
pnpm dlx sharp-cli --input "$SVG" --output "$ROOT/public/icon-192.png" resize 192
pnpm dlx sharp-cli --input "$SVG" --output "$ROOT/public/icon-512.png" resize 512

echo "Wrote public/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png"
