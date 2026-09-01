# A1 Validation — 2026-09-01

Validation scope: brand, menu and dataset only.

- Canonical count: 36 pizzas.
- Savory: 31.
- Sweet: 5.
- `recognitionEnabled`: 36/36 true.
- `confidenceTier`: preserved from Tech Lead freeze.
- `availabilityStatus`: preserved from Tech Lead freeze.
- `nocciola-chocolat-du-jour`: remains `availability_conflict`.
- Individual direct official visual references: 6/36.
- No HTML page or composite menu page was inserted as a fake SKU image.
- Verified logo light registered in `data/brand.json`.
- Exact brand HEX and typography remain explicitly unverified rather than inferred.
- Supplemental official signal `Pancetta e Patate` is documented but not added as a silent 37th class.

The runtime must continue to return `inconclusive` for low evidence / near-neighbor ambiguity; 36-class coverage is not permission to force a prediction.
