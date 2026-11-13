#!/usr/bin/env bash
# One command: build the static export and publish it to the gh-pages branch of NaukhanGreenwin/snow-log.
# Live at https://naukhangreenwin.github.io/snow-log/  (brands: ?c=<slug>, see APP-NOTES / README).
set -euo pipefail
cd "$(dirname "$0")"
REMOTE="$(git remote get-url origin)"
npx next build
touch out/.nojekyll
TMP="$(mktemp -d)"
git clone -q --branch gh-pages --single-branch "$REMOTE" "$TMP" 2>/dev/null || { rm -rf "$TMP"; mkdir -p "$TMP"; git -C "$TMP" init -q -b gh-pages; git -C "$TMP" remote add origin "$REMOTE"; }
# Keep older hashed _next/static files so a phone that opened the app before this deploy can still
# lazy-load its own chunks (the PDF code). Everything else is replaced.
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git ! -name _next -exec rm -rf {} +
find "$TMP/_next" -mindepth 1 -maxdepth 1 ! -name static -exec rm -rf {} + 2>/dev/null || true
cp -R out/. "$TMP/"
cd "$TMP"
git add -A
git -c user.name="IT Rapid Support" -c user.email="snowlog-deploy@users.noreply.github.com" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)" || echo "nothing to commit"
git push -q origin gh-pages
echo "Deployed: https://naukhangreenwin.github.io/snow-log/"
