# Braciera Vision API contract — v1

## `POST /v1/analyze`

`multipart/form-data`, field `image`. Server normalizes orientation and resizes to max 1600 px before sending a JPEG to OpenAI.

### Success / inconclusive payload

```json
{
  "status": "success | inconclusive",
  "pizzaId": "zozzona | null",
  "pizzaName": "Zozzona | null",
  "confidenceLabel": "high | medium | low | unavailable",
  "confidenceScore": 0.93,
  "alternatives": [{"pizzaId":"caprese","pizzaName":"Caprese","confidenceScore":0.31}],
  "ingredients": ["..."],
  "referenceImage": null,
  "qualitySignals": [{"label":"Borda / cornicione","state":"positive | attention | unknown","detail":"..."}],
  "warnings": [],
  "nutritionSource": null,
  "requestId": "uuid",
  "model": "gpt-5.6-luna",
  "promptVersion": "braciera-vision-v1.0.0"
}
```

The server owns catalog facts. The model never supplies ingredients/reference fields to the UI. A model choice below `CONFIDENCE_THRESHOLD` is converted to `inconclusive`; an unknown slug is always converted to `inconclusive`.

### Errors

Errors use HTTP status codes and `{ "status":"error", "error": {"code":"...","message":"..."}, "requestId":"..." }`. OpenAI/network failures never become pizza results.
