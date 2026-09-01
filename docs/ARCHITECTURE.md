# Architecture — Braciera Vision

## MVP

```text
GitHub Pages / React + Vite + TypeScript
  ├─ mobile camera via getUserMedia
  ├─ gallery via input[type=file]
  ├─ image preview + normalization
  └─ POST image -> secure API
                      ├─ OpenAI multimodal
                      ├─ catalog-constrained classification
                      ├─ structured JSON schema
                      └─ error / inconclusive handling
```

## Frontend

- Mobile-first from 360 px upward.
- Prefer rear camera with `facingMode: environment`.
- Keep gallery/upload as equal first-class path.
- Normalize image orientation/size before upload.
- Motion for React for state transitions and shared layout.
- GitHub Pages uses Vite project base `/lightpath-vision/` until a custom domain is configured.

## Backend contract

Frontend must not know the OpenAI secret. Backend exposes a minimal analysis endpoint and returns a stable result contract.

Suggested result shape:

```json
{
  "status": "matched|inconclusive|error",
  "predictedFlavor": "zozzona",
  "confidence": 0.94,
  "topCandidates": [],
  "ingredients": [],
  "referenceMatch": 0.91,
  "visualSignals": {
    "shape": null,
    "bake": null,
    "toppingDistribution": null,
    "crust": null
  },
  "warnings": []
}
```

Use a real structured-output schema in implementation. `inconclusive` is a valid answer, not an exception.

## Catalog

The full known menu is a knowledge catalog. Recognition must be enabled only for classes with enough high-quality official/current visual references.

Suggested fields:

```ts
type MenuItem = {
  slug: string
  displayName: string
  aliases: string[]
  category: string
  ingredients: string[] | null
  source: string
  sourceDate: string | null
  confidenceTier: "A" | "B" | "C"
  recognitionEnabled: boolean
  referenceImages: string[]
  notes?: string
}
```

## Quality Intelligence evolution

Production should eventually receive the expected SKU/order from POS instead of asking vision to discover it blindly:

`order/SKU -> capture -> visual conformance -> approve/review/remake -> telemetry`.

Candidate metrics supported by prior pizza computer-vision literature include base circularity, sauce coverage, topping percentage and topping distribution. These require calibration with La Braciera-approved samples before being treated as operational standards.

## Failure rules

- API failure stays an API failure.
- Low confidence returns `inconclusive`.
- Never display mock quality scores as if produced by the model.
- Never expose secrets in client bundles, GitHub Pages or `VITE_*` variables.
