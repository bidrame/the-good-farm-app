#!/usr/bin/env bash
# Recompile l'appli et la publie sur GitHub Pages (branche gh-pages).
# Les réglages Supabase viennent de .env.local ; DOMAINE (facultatif) = domaine personnalisé, ex. ferme.thegoodfarm.sn
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
if [ -n "${DOMAINE:-}" ]; then base=/; else base=/the-good-farm-app/; fi
rm -rf dist
VITE_BASE=$base npm run build
touch dist/.nojekyll
[ -n "${DOMAINE:-}" ] && echo "$DOMAINE" > dist/CNAME
cd dist
git init -q -b gh-pages
git add -A
git commit -qm "Publication de l'appli"
git push -f https://github.com/bidrame/the-good-farm-app.git gh-pages
rm -rf .git
echo "Publié. En ligne d'ici une minute."
