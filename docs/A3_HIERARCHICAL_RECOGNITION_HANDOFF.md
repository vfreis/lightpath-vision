# A3 Handoff — Hierarchical Recognition v2

## Baseline locked

- Model: `gpt-4.1-mini` (config rejects another `OPENAI_MODEL`).
- OpenAI Responses API + Structured Outputs/Zod.
- `store:false`.
- No CLIP, SigLIP or DINOv2 in runtime. Add retrieval only after an apples-to-apples eval on the same versioned test set.

## Runtime pipeline

`quality gate -> family router -> visual fingerprint -> shortlist 3–5 -> reference-grounded rerank -> selective abstention`

The first OpenAI call does not choose the final item. The second call receives only the validated shortlist and official references available for those candidates.

### Family router

Supported recognition families are `pizza`, `calzone`, `dolci`. `other` and `inconclusive` stop before reranking. Existing catalog entries derive family from category until the canonical dataset carries an explicit `family` field.

### Quality gate

`pass | retry | inconclusive`. Anything other than `pass` stops before the second OpenAI call.

### Fingerprint

The schema separates observable signals from `notVisible`. Missing visibility must not be interpreted as ingredient absence.

### Shortlist

Model suggestions are filtered server-side by enabled catalog and routed family. Confusion-set neighbors are then added deterministically, capped at 5. Reranking refuses a shortlist outside 3–5.

## Confusion sets

Canonical runtime file: `data/confusion-sets.json`.

Current explicit groups cover:
- Margherita / Verace / Burrata;
- Calabresa / Castelões / Zozzona;
- burrata/pesto variants;
- Parma/white-cheese variants;
- Nutella/pistacchio dolci.

Update discriminators only from confirmed menu/reference evidence or confirmed hard negatives.

## Hard negatives

Registry: `data/hard-negatives.json`.

It is intentionally empty at merge time. Do not populate it from an unverified model error. Every record needs confirmed ground truth. Supported record semantics in `api/src/recognition-context.ts` include expected/predicted ID, family, confusion set, observations, provenance and optional remote image URL.

A confirmed hard negative relevant to a shortlist is injected in the second-stage context as a counterexample. It never becomes a positive training example automatically.

## References

The reranker receives only official remote references attached to shortlist items. If the selected class has no official positive reference, `precalibration-v1` currently abstains. This is intentionally conservative: reference coverage must be expanded rather than hidden by model confidence.

## Abstention / calibration

Runtime policy: `data/abstention-policy.json`.

Current status: `pending_eval`.

The VLM emits `heuristicScore`, never calibrated probability. Public API remains:
- `confidenceScore: null`;
- `confidenceCalibrated: false`;
- `recognition.calibratedProbability: null`.

`api/src/calibration.ts` provides offline selective-classification calibration. Given labeled samples, it searches score/margin thresholds that maximize coverage under a configurable false-positive ceiling. It can also calibrate by confusion set when enough samples exist.

Do not flip policy/calibration wording to calibrated until the same versioned eval set has been run and archived.

## Public API compatibility

`POST /api/v1/analyze` keeps the existing top-level shape used by frontend. It adds `recognition` diagnostics and `meta.abstentionPolicyVersion`. `pizzaId`/`pizzaName` remain legacy field names for compatibility.

`GET /healthz` now reports:
- `recognitionPipeline=hierarchical-v2`;
- model;
- confusion-set count;
- confirmed hard-negative count;
- calibration status/policy version.

## A4 validation checklist

1. Run `npm --workspace @lightpath/braciera-vision-api run typecheck`.
2. Run `npm --workspace @lightpath/braciera-vision-api test`.
3. Run full root build and Hostinger smoke.
4. Confirm `/healthz` model is exactly `gpt-4.1-mini` and pipeline `hierarchical-v2`.
5. Test bad/blurred/cropped/multi-product images: no second-stage accepted classification; result `inconclusive`.
6. Test `other` food/object and out-of-catalog pizza: `inconclusive`.
7. Exercise each confusion set with real labeled images and record top1/top3.
8. Confirm accepted matches have an official reference and adequate reference agreement.
9. Every confirmed false positive becomes a hard-negative record and a permanent eval case.
10. Produce metrics: top1, top3 recall, accepted accuracy, false-positive rate, inconclusive rate/coverage, per-class recall, confusion matrix and latency split by stage.
11. Calibrate `data/abstention-policy.json` from eval results; preserve `pending_eval` until measured.
12. Do not introduce embedding retrieval until a comparative eval demonstrates gain over this VLM shortlist baseline.
