# Snow Log

Snow clearing and salting log for property sites, by IT Rapid Support. Site staff log each visit on
their phone: property, date and start/finish time (Alberta time), crew, areas cleared, method, salt /
ice melt / sand (product, amount, where), weather (filled from Open-Meteo by GPS when online, always
editable), GPS stamp, time-stamped before and after photos, hazards and notes, and a signature. The
phone then builds the PDF report and keeps it in History so it can be shared or downloaded again.

Live: https://itrapidsupport.github.io/snow-log/ (noindex: meta robots + robots.txt)
Per company: `https://itrapidsupport.github.io/snow-log/?c=<slug>` (brands in `src/brands.json`).

Next.js 16 static export (App Router, TypeScript), no server and no database. The visit in progress is
in localStorage, photos are JPEG bytes in IndexedDB, finished visits stay in IndexedDB for History. A
service worker keeps the app usable offline. The demo's "Email the report" opens the phone's share
sheet (Mail) with the PDF, and falls back to a download; the production version emails the office
automatically.

Each company's real logo is self-hosted in `public/logos/<slug>.png` (pipeline in `scripts/logos/`:
Firecrawl branding scrape -> download/trim/judge -> manual overrides -> `apply.py` writes `src/brands.json`);
companies without a usable logo get a monogram. Coverage: `public/logos/manifest.json`. The PDF embeds
Instrument Sans from `public/fonts/`.

Files: `src/components/App.tsx` (screens and flow), `src/lib/pdf.ts` (report), `src/lib/store.ts`,
`src/lib/photos.ts`, `src/lib/weather.ts`, `src/lib/brand.ts`, `src/lib/time.ts`, `public/sw.js`.

    npm install
    npm run dev                                   # http://localhost:3000/snow-log/
    python3 scripts/add_brands.py rows.json       # add companies, prints one link per company
    ./deploy.sh                                   # build + publish into snow-log/ of itrapidsupport.github.io
    node test/flow.mjs [url]                      # iPhone 13 WebKit + Pixel 7 Chromium full-visit test
    node test/sample.mjs "<url>?c=<slug>" <out.pdf> <dir>   # sample report for a company
    node test/showcase.mjs <url> <slug> <dir>     # three design screenshots
