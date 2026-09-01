# Braciera Vision API contract — v1.1

## `POST /v1/analyze`

`multipart/form-data`, field `image`. The server validates and normalizes orientation, requires at least 160 px per dimension, resizes to max 1600 px, flattens transparency and re-encodes to JPEG before sending the image to OpenAI.

### Success / inconclusive payload

```json
{
  "status": "success | inconclusive",
  "pizzaId": "zozzona | null",
  "pizzaName": "Zozzona | null",
  "confidenceLabel": "high | medium | low | unavailable",
  "confidenceScore": null,
  "confidenceCalibrated": false,
  "alternatives": [{"pizzaId":"caprese","pizzaName":"Caprese","confidenceScore":null}],
  "ingredients": ["..."],
  "referenceImage": null,
  "qualitySignals": [{"label":"Borda / cornicione","state":"positive | attention | unknown","detail":"..."}],
  "warnings": [],
  "nutritionSource": null,
  "requestId": "uuid",
  "model": "gpt-5.6-luna",
  "promptVersion": "braciera-vision-v1.1.0"
}
```

The server owns catalog facts. The model never supplies ingredients/reference fields to the UI. A model choice below `CONFIDENCE_THRESHOLD`, outside the enabled catalog, or with a margin to the next valid candidate below `MIN_TOP_MARGIN` is converted to `inconclusive`.

The model's numeric confidence is an internal heuristic only. Until real calibration exists, the public API intentionally returns `confidenceScore: null`, `confidenceCalibrated: false`, and a qualitative `confidenceLabel`.

When the catalog includes HTTP(S) `referenceImage`/`referenceImages`, the request may attach up to `MAX_REFERENCE_IMAGES` (default 8), one per enabled SKU. No reference URL is fabricated when the catalog has none.

### Errors

Errors use HTTP status codes and `{ "status":"error", "error": {"code":"...","message":"..."}, "requestId":"..." }`. Relevant codes include `OPENAI_NOT_CONFIGURED`, `IMAGE_REQUIRED`, `IMAGE_TOO_LARGE`, `IMAGE_TOO_SMALL`, `UNSUPPORTED_MEDIA_TYPE`, `INVALID_IMAGE`, `OPENAI_TIMEOUT`, `OPENAI_RATE_LIMIT`, `OPENAI_ERROR`, `OPENAI_INVALID_RESPONSE`, `CORS_DENIED`, and `INTERNAL_ERROR`. OpenAI/network failures never become pizza results.

### GitHub Pages / secrets

Production should set `ALLOWED_ORIGINS=https://vfreis.github.io`. The frontend needs only public `VITE_API_BASE_URL`; `OPENAI_API_KEY` must exist only in the backend environment/secret manager and must never be placed in a `VITE_*` variable or client bundle. The OpenAI request uses `store:false`.
