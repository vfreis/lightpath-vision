# Skill — Vision Menu Classifier

Use this skill for multimodal classification and visual-quality preview work.

## Source hierarchy

1. Official current La Braciera menu / full-menu pages.
2. Official La Braciera experience pages.
3. Fresh unit/menu listings and press only as reconciliation evidence.
4. Historical/third-party sources never override current official evidence.

## Classification contract

- The model receives only canonical catalog candidates enabled for recognition.
- Output must validate against a strict structured schema.
- `status` is one of `matched`, `inconclusive`, `error`.
- Never force a flavor when confidence/evidence is inadequate.
- Keep top candidates for diagnostics but UI should emphasize the chosen result only when matched.
- Ingredients shown to the user come from catalog data, not improvised model prose.
- The AI may inspect visual characteristics but must not invent exact weights, nutritional values or official quality thresholds.

## Quality preview

Candidate visual signals: shape/circularity, crust/cornicione appearance, bake pattern, sauce/topping coverage and topping distribution. Label these experimental until La Braciera supplies approved examples and acceptance thresholds.

## Production direction

Prototype: photo -> identify flavor -> preview visual quality.
Production target: order/POS supplies expected SKU -> photo -> verify conformance to that SKU -> approve/review/remake.

## Safety / correctness

- OpenAI secret only server-side.
- Real API failure remains an error.
- No mock fallback that looks real.
- Version prompts and schemas.
- Log latency/token/cost metadata without logging image content unnecessarily.
