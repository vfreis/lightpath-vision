# Deploy

## Frontend — GitHub Pages

The Pages workflow builds `frontend/` with Vite base `/lightpath-vision/`. Configure repository **Actions variable** `VITE_API_BASE_URL` to the HTTPS backend origin (no trailing slash) and enable GitHub Pages with **GitHub Actions** as source.

Expected URL: `https://vfreis.github.io/lightpath-vision/`.

## Backend — any HTTPS Node 22 host

Run `npm install` then `npm --workspace backend start`. Required secret: `OPENAI_API_KEY`. Recommended env values are in `backend/.env.example`. `ALLOWED_ORIGINS` must include exactly the Pages origin; localhost is only for development.

The OpenAI key is never read by Vite and must never be stored in repository variables exposed to the client. Use the provider's server-side secret store.

## Demo segura

`frontend/src/demo.ts` intentionally starts empty. Add a sample only after: (1) the exact real image is licensed/approved for the demo, (2) it has been analyzed by the live backend, (3) SHA-256 and validation timestamp are recorded, and (4) the stored result is the exact real API result. Do not hand-author a successful classification fixture.
