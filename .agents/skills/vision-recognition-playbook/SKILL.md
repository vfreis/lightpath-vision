# Skill — Braciera Vision Recognition Playbook

Use this skill whenever changing catalog recognition, prompts, reference images, thresholds or evaluation.

## Baseline

- Keep `gpt-4.1-mini` as the baseline until evals show another model is materially better.
- This is fine-grained recognition with visually similar classes; never force a prediction.
- Menu pages supplied by the user are the primary supervised source because they pair image + name + ingredients.

## Required pipeline

1. **Image quality gate** — reject/retry severe blur, crop, occlusion, multiple products, bad exposure or unusable perspective.
2. **Family router** — classify `pizza`, `calzone`, `dolci`, `other`, `inconclusive`.
3. **Visual fingerprint** — extract visible evidence only: shape, sauce/base, cheese pattern, apparent proteins, vegetables, creams/burrata, topping distribution, sweet/savory cues. Distinguish `not_visible` from `absent`.
4. **Shortlist** — reduce canonical catalog to 3–5 candidates using fingerprint + ingredients + confusion groups.
5. **Reference-grounded rerank** — compare user image only with the shortlisted candidates and their official/canonical reference crops.
6. **Selective decision** — accept only when score/margin/evidence pass calibrated gates; otherwise `inconclusive`.

## Catalog supervision

For every item preserve:
- `family`, `slug`, `displayName`, aliases
- canonical ingredients
- allergens / spicy / individual-only / gluten-free-option metadata
- source page and provenance
- reference crops/images
- confusion group
- discriminating visual cues

Gluten-free dough is metadata/order context, not a visually reliable product class.

## Confusion sets

Maintain explicit groups of similar classes. For each group document 2–5 discriminators. Examples include Margherita variants, Calabresa/Castelões/Zozzona, burrata pizzas, and Nutella/pistachio sweets.

## Evals

Every confirmed wrong classification becomes a hard negative after ground truth is verified. Keep a versioned immutable eval set and measure:
- top-1 accuracy
- top-3 recall
- accepted accuracy
- false-positive rate
- inconclusive rate / coverage
- per-class recall
- confusion matrix
- latency

Never accept prompt/model/threshold changes without running the same eval set.

## Confidence

Do not present VLM self-reported confidence as calibrated probability. Calibrate thresholds empirically on the eval set. Optimize first for low false-positive rate and high accepted accuracy; coverage is secondary for the demo.

## Multi-view

For hard cases, optionally use full image plus one focused crop or ask for a new guided capture. Do not multiply calls without measured benefit.

## Retrieval roadmap

CLIP, SigLIP and DINOv2 are optional post-MVP retrieval engines for candidate shortlisting. Do not add their runtime weight to the Hostinger MVP unless the same eval set proves a meaningful quality/latency benefit. Prefer precomputed reference embeddings or a separate retrieval service if adopted later.

## Recognition vs QA

Do not conflate identity with quality. Recognition identifies the catalog item. QA evaluates shape/circularity, sauce spread, topping coverage/distribution, bake and cornicione only against approved operational references.

## Safety / truthfulness

- Structured Outputs / strict schema.
- No fake fallback.
- OpenAI key server-side only.
- Ingredients displayed come from canonical catalog, never improvised prose.
- Out-of-catalog or weak evidence => `inconclusive`.
