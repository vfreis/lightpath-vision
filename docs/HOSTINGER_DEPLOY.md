# Braciera Vision — Hostinger Node.js Web App

Target: Hostinger managed Node.js Web App, deployed from the repository root.

## Build settings

- Repository: `vfreis/lightpath-vision`
- Root directory: `.` (repository root)
- Node.js: `22.x`
- Package manager: `npm`
- Install: `npm install`
- Build: `npm run hostinger:build`
- Start: `npm start`
- Runtime port: `3000`

The root `package.json` delegates build/start to the canonical `api/` workspace. Do not deploy the deprecated `backend/` stack.

## Hostinger environment variables

Add these in the Node.js Web App Environment variables UI. Do not upload a populated `.env` and do not expose any secret as `VITE_*`.

```text
OPENAI_API_KEY=<secret only in Hostinger>
OPENAI_MODEL=gpt-5.6-luna
OPENAI_TIMEOUT_MS=30000
ALLOWED_ORIGINS=https://vfreis.github.io
NODE_ENV=production
PORT=3000
MAX_UPLOAD_MB=8
MAX_IMAGE_EDGE=1600
MAX_REFERENCE_IMAGES=8
MATCH_THRESHOLD=0.78
MIN_TOP_MARGIN=0.10
RATE_LIMIT_PER_MINUTE=20
```

`MENU_CATALOG_PATH` should normally remain unset. The API resolves the canonical `data/menu.json` from the monorepo and overlays verified URLs from `data/reference-images.json`.

## Catalog invariant

Production startup requires exactly 36 catalog items and exactly 36 `recognitionEnabled=true` classes. If that invariant is broken, startup fails instead of silently serving a partial classifier.

Coverage does not mean forced classification: low evidence, an out-of-catalog image, or insufficient margin between candidates must still return `inconclusive`.

## Pre-deploy validation

From the repository root:

```bash
npm install
npm run typecheck
npm test
npm run hostinger:build
npm run hostinger:smoke
```

The Hostinger smoke starts the compiled API on Node 22 / port 3000 and validates:

- `GET /healthz` returns 200, catalog size 36 and recognition classes 36;
- `GET /api/v1/catalog` returns 36 unique pizzas;
- `POST /api/v1/analyze` with a valid normalized image returns the explicit `openai_not_configured` error when no key is present, proving the endpoint does not fall back to a fictitious result;
- GitHub Pages CORS is accepted.

## Post-deploy smoke

Replace `https://API_HOST` with the Hostinger Node.js Web App URL.

```bash
curl -fsS https://API_HOST/healthz
curl -fsS https://API_HOST/api/v1/catalog
curl -sS -F 'image=@pizza.jpg' https://API_HOST/api/v1/analyze
```

Expected production health indicators:

```json
{
  "status": "ok",
  "catalogItems": 36,
  "recognitionClasses": 36,
  "expectedRecognitionClasses": 36,
  "openaiConfigured": true,
  "port": 3000
}
```

For a real image, `/api/v1/analyze` may return `success` or `inconclusive`. Provider/network/configuration failures must return an HTTP error with the stable error contract; they must never become a pizza classification.

## A4 handoff gate

A4 should not mark the live backend GO until all three public endpoints pass over HTTPS, `openaiConfigured=true`, the frontend `VITE_API_BASE_URL` points to that HTTPS origin, and a real image reaches OpenAI without leaking the key to the browser bundle or repository.
