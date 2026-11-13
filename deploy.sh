#!/usr/bin/env bash
# One command: build the static export and publish it into the /snow-log/ folder of
# itrapidsupport/itrapidsupport.github.io (branch main, GitHub Pages from the repo root).
# Live at https://itrapidsupport.github.io/snow-log/  (brands: ?c=<slug>, see APP-NOTES / README).
#
# Additive only: a sparse checkout of snow-log/ is the only thing staged. Every other folder in that
# repo (the inspection apps, robots.txt, _next/ at the root) is never checked out or touched.
set -euo pipefail
cd "$(dirname "$0")"
REMOTE="https://github.com/itrapidsupport/itrapidsupport.github.io.git"
DIR="snow-log"
npx next build
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --filter=blob:none --no-checkout --branch main "$REMOTE" "$TMP"
git -C "$TMP" sparse-checkout set --no-cone "/$DIR/"
git -C "$TMP" checkout -q main
mkdir -p "$TMP/$DIR"
# Keep older hashed _next/static files so a phone that opened the app before this deploy can still
# lazy-load its own chunks (the PDF code). Everything else under snow-log/ is replaced.
find "$TMP/$DIR" -mindepth 1 -maxdepth 1 ! -name _next -exec rm -rf {} +
find "$TMP/$DIR/_next" -mindepth 1 -maxdepth 1 ! -name static -exec rm -rf {} + 2>/dev/null || true
cp -R out/. "$TMP/$DIR/"
rm -f "$TMP/$DIR/.nojekyll"   # the repo root already has its own; nothing to add there
cd "$TMP"
git add -A -- "$DIR"
# Safety: refuse to push anything outside snow-log/.
if git diff --cached --name-only | grep -v "^$DIR/" | grep -q .; then
  echo "ABORT: staged changes outside $DIR/"; git diff --cached --name-only | grep -v "^$DIR/" | head; exit 1
fi
git -c user.name="IT Rapid Support" -c user.email="snowlog-deploy@users.noreply.github.com" commit -q -m "Snow Log: deploy $(date -u +%Y-%m-%dT%H:%MZ)" || { echo "nothing to commit"; exit 0; }
git push -q origin main
echo "Deployed: https://itrapidsupport.github.io/$DIR/"
