# Deploy

## Backend — Hostinger Node.js Web App

Deploy from the **repository root**. The root package is intentionally production-ready for the API:

```bash
npm install
npm run build
npm start
```

Contract:

- Node `22.x`
- port `3000`
- `GET /healthz`
- `GET /api/v1/catalog`
- `POST /api/v1/analyze`

Secrets/env are configured in Hostinger. `OPENAI_API_KEY` is server-side only. In production use `ALLOWED_ORIGINS=https://vfreis.github.io` and the remaining limits/thresholds from `api/.env.example`.

Full instructions and the strict smoke matrix are in `docs/HOSTINGER_GO_LIVE.md`.

## Frontend — GitHub Pages

The Pages workflow compiles `frontend/` with Vite base `/lightpath-vision/`. Configure the repository Actions variable:

```text
VITE_API_BASE_URL=https://<temporary-hostinger-origin>
```

Enable GitHub Pages with **GitHub Actions** as source. Expected URL:

```text
https://vfreis.github.io/lightpath-vision/
```

The frontend never receives `OPENAI_API_KEY`. It performs `/healthz` itself and only exposes LIVE as ready when the API reports 36 recognition classes and OpenAI configured.

## Demo Segura

`frontend/src/demo-samples.json` starts as `[]`. Do not hand-author successful fixtures.

Use the real Hostinger API:

```bash
API_BASE_URL=https://<temporary-hostinger-origin> npm run demo:validate
```

After reviewing the real results, use `WRITE_DEMO=1` to generate the manifest. Every entry records SHA-256, API origin, validation timestamp, provenance and the exact real response. At presentation time the browser verifies the hash and calls the LIVE API again; a stored result is never shown as fallback.
