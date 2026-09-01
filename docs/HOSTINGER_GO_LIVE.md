# Braciera Vision — Hostinger go-live

## Deploy contract

Target: **Hostinger Node.js Web App**, deploy from the **monorepo root**.

- Node: `22.x` (`.nvmrc` + root/API `engines`)
- Build command: `npm run build`
- Start command: `npm start`
- Port: `3000`
- Health: `GET /healthz`
- Catalog: `GET /api/v1/catalog`
- Analyze: `POST /api/v1/analyze` (`multipart/form-data`, field `image`)

The root build intentionally compiles only the API for Hostinger. GitHub Pages builds the frontend separately. `npm run build:all` remains available for full local/CI verification.

## Hostinger environment variables

Set these in Hostinger, never in the frontend repository bundle:

```text
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5.6-luna
OPENAI_TIMEOUT_MS=30000
ALLOWED_ORIGINS=https://vfreis.github.io
MAX_UPLOAD_MB=8
MAX_IMAGE_EDGE=1600
MAX_REFERENCE_IMAGES=8
MATCH_THRESHOLD=0.78
MIN_TOP_MARGIN=0.10
RATE_LIMIT_PER_MINUTE=20
PORT=3000
NODE_ENV=production
```

`MENU_CATALOG_PATH` is optional. The API discovers the canonical monorepo `data/menu.json` automatically and must report 36 `recognitionClasses`.

## Hostinger acceptance

After Hostinger exposes its temporary HTTPS origin:

```bash
API_BASE_URL=https://<temporary-hostinger-origin> \
CORS_ORIGIN=https://vfreis.github.io \
npm run smoke:api
```

The smoke harness is intentionally strict. It checks:

1. HTTPS `/healthz`, `status=ok`, exactly **36** recognition classes and OpenAI configured.
2. CORS for `https://vfreis.github.io`.
3. `/api/v1/catalog` with 36 items and at least six verified official reference images.
4. Explicit `image_required` error; no fabricated result.
5. A low-information valid JPEG must return `inconclusive`.
6. A Creative Commons Hawaiian pizza outside the La Braciera catalog must return `inconclusive`.
7. Official distinctive references (`zozzona`, `nutella-lindt-brownie` by default) must classify to their expected SKU.
8. Similar-class references (`caprese`, `cuore-di-napoli` by default) may classify correctly or return `inconclusive`, but must never become a wrong confident SKU.

Out-of-catalog QA image source: Wikimedia Commons `Hawaiian pizza 2023.jpg`. It is test evidence only and is not a La Braciera reference/demo asset.

## Frontend integration

Set the GitHub Actions repository variable:

```text
VITE_API_BASE_URL=https://<temporary-hostinger-origin>
```

Then publish the Pages workflow. Expected frontend origin:

```text
https://vfreis.github.io/lightpath-vision/
```

The frontend now performs its own `/healthz` check. It only displays `LIVE pronto` when it sees 36 classes and `openaiConfigured=true`.

## Safe Demo

The Safe Demo manifest starts empty. Never hand-author a success fixture.

Run the live validator against the same Hostinger API:

```bash
API_BASE_URL=https://<temporary-hostinger-origin> \
CORS_ORIGIN=https://vfreis.github.io \
npm run demo:validate
```

This dry run downloads the exact verified official images, hashes them with SHA-256, sends the exact bytes to the real API and requires `success` with the expected pizza ID.

Only after reviewing the live results:

```bash
API_BASE_URL=https://<temporary-hostinger-origin> \
CORS_ORIGIN=https://vfreis.github.io \
WRITE_DEMO=1 \
npm run demo:validate
```

This writes `frontend/src/demo-samples.json`. During the presentation the browser downloads the image again, verifies the SHA-256, and **reanalyzes it through the live API**. If the current response differs from the pre-validation, the UI shows the current response and a drift warning. The stored result is never used as a fallback classification.

## Physical mobile gate

No GO is allowed until the published HTTPS frontend is tested on at least:

- Safari on a real iPhone: rear camera permission, capture, portrait/landscape source orientation, gallery, retake, permission denied, offline/network failure, result and `inconclusive`.
- Chrome on a real Android device: same matrix.
- Width around 360 px, safe areas and `prefers-reduced-motion`.

Record device/browser versions and request IDs for the successful live analyses.

## GO rule

GO requires all of the following at the same time:

- Hostinger API deployed and `/healthz` proves 36 classes + OpenAI.
- API smoke passes with real OpenAI calls and official reference images.
- GitHub Pages is actually published with the Hostinger HTTPS API origin.
- Safe Demo contains only validator-generated real samples.
- LIVE camera/gallery works end-to-end on real iPhone and Android.
- Network/OpenAI errors remain explicit errors; poor/out-of-catalog/ambiguous images do not force a pizza.

Until then, status is **NO-GO**.
