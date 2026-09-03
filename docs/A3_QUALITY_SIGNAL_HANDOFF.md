# A3 Handoff — Quality Signal Contract v1

## Objective

Integrate the approved training/export artifacts into the backend as an **observable signal scaffold**, while keeping `gpt-4.1-mini` as the complementary semantic/reference layer and never presenting uncalibrated quality as an operational verdict.

## Canonical source artifacts

Training export provenance:

- canonical bundle folder: `07_exports_demo/model_bundle_v1`
- Drive folder ID: `1sMJekrLczPdOPyTzxrqhDpzRpNYbWhL1`
- feature schema: `braciera_features_v2_no_family_leakage`
- feature schema file ID: `1NvGGpfpXyoC382CM-RS97exlBX5VM2fb`
- quality observable scaffold file: `quality_features.csv`
- quality features file ID: `1yxE2zOAd67WeAVLjQK67eG-Lkeh8vjSJ`
- training scope on that CSV: `observable_scaffold_not_quality_verdict`

Repository descriptor: `data/training-bundle-quality-profile.v1.json`.

The exported sklearn/joblib classifier thresholds are **not** enabled as autonomous runtime decisions. The real-domain A1 evals did not validate them for production. This is intentional and prevents importing a known NO-GO selective classifier as a false source of quality certainty.

## Runtime integration

`api/src/quality-signals.ts` extracts a lightweight Node/Sharp projection aligned with the M5 feature semantics before GPT runs:

- crust/cornicione: outer-ring width/edge/value proxies;
- leopard spotting: dark-ratio proxy in outer ring;
- texture: grayscale spread + edge density;
- blur: Laplacian-variance proxy;
- shape: area/circularity/aspect proxies;
- radial distribution: center/mid/crust value readings;
- semantic cues: red/green/yellow/dark/cream/toast/high-saturation ratios.

These signals are fed to both GPT stages as **complementary evidence** with an explicit instruction that they are neither probability nor quality verdict.

The recognition path remains:

`bundle observables -> gpt-4.1-mini quality/family/fingerprint -> shortlist -> official-reference rerank -> abstention`

## Public API contract

`POST /api/v1/analyze` now explicitly returns:

- `family`
- `recognitionStatus = recognized | inconclusive`
- `predictedItem`
- `reference`
- `observableSignals`
- `quality_status`
- `quality_notes`

Legacy `pizzaId`, `pizzaName`, `referenceImage`, `qualitySignals` remain temporarily for frontend compatibility.

### Quality status allowlist

Until a client-approved good/bad dataset exists, only:

- `not_calibrated`
- `experimental_compatible`
- `experimental_attention`
- `inconclusive`

`experimental_compatible` means only that the POC observation is visually compatible with the identity reference used in that comparison. It does **not** mean approved quality.

`experimental_attention` means an observable/photo/reference signal deserves human checking. It does **not** mean rejection.

## Quality notes language

Notes are generated deterministically server-side from observable signals, using workstation/pizzaiolo vocabulary such as:

- cornicione;
- pontos de forno / leoparding;
- montagem;
- centro/faixa intermediária/borda;
- distribuição;
- referência da casa;
- nitidez.

The contract rejects certification/verdict wording. All accepted experimental states retain a note that operational quality is not calibrated with client-approved good/bad images.

## Inconclusive privacy rule

Weak recognition is no longer surfaced as a pseudo-answer.

For public `inconclusive`:

- `predictedItem=null`
- `reference=null`
- `alternatives=[]`
- `recognition.shortlist=[]`

Internal shortlist/ranking still exists in `HierarchicalDecision` for eval/hard-negative mining, but it is not sent to the frontend.

## Health

`GET /healthz` adds:

- `recognitionPipeline=hierarchical-v2+bundle-observables`
- `qualitySignalContract=observable-signals.v1`
- `qualityCalibrationStatus=not_calibrated`
- `trainingBundleQualityVersion=quality-signal-profile.v1`
- `trainingBundleRole=complementary_observable_scaffold`
- `autonomousBundleClassifierEnabled=false`
- model remains exactly `gpt-4.1-mini`.

## A4 acceptance tests

A4 must validate before merge/deploy:

1. API typecheck and all tests.
2. `gpt-4.1-mini` remains the only configured OpenAI model.
3. A clear in-catalog photo returns all seven observable signal groups.
4. `quality_status` is always one of the four allowlisted values.
5. No response contains an operational approval/rejection/certification claim.
6. Blur/bad framing produces `inconclusive` or experimental attention, never a quality pass/fail.
7. Recognition inconclusive exposes no alternatives and no public shortlist.
8. Success hydrates predicted item and reference from server catalog, not model text.
9. `observableSignals.meta.calibratedQuality=false` and health reports `qualityCalibrationStatus=not_calibrated`.
10. Run live Hostinger smoke with real gallery/camera photos and preserve client `holdout_v1` outside training/tuning.

## Calibration gate

Do not change quality semantics to `within_standard`, `outside_standard`, approved/rejected, or similar until:

- the client supplies/validates good and bad examples;
- those examples are split without leakage;
- per-signal/combined calibration is measured;
- false-positive/false-negative policy is agreed with La Braciera;
- a new versioned contract explicitly replaces this POC contract.
