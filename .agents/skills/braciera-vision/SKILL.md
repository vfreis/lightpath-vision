# Skill — Braciera Vision Project Contract

Use this as the umbrella contract for every agent working in `vfreis/lightpath-vision`.

## Canonical context

When Vault access is available, read in order:

1. `vault_vifalqueiro/Projetos/La Braciera/00_INDEX`
2. `CURRENT_STATE`
3. `01_MASTER_PROJECT`
4. `02_BRAND_KIT`
5. `03_AGENT_EXECUTION_PLAN`
6. `04_MENU_DATASET`
7. `05_TECH_REFERENCES_AND_SKILLS`
8. `06_UX_MOTION_SPEC`

Then validate the current repository before changing code.

## Product promise

Braciera Vision is a sales prototype for a future visual quality-intelligence layer. The MVP recognizes selected La Braciera pizzas from a controlled catalog, displays official catalog information and previews visual-quality signals. It is not yet a production-certified quality-control system.

## Non-negotiables

- Mobile first.
- Camera and device gallery are both first-class flows.
- Beautiful but performant motion.
- La Braciera-facing visual identity; LightPath attribution is subtle.
- OpenAI key server-side only.
- No fabricated fallback result.
- `inconclusive` is valid.
- Catalog facts come from sourced data, not model invention.
- Nutrition is not inferred precisely from a photo.
- Do not modify Dermaly; reuse patterns only.
- Keep changes scoped so the meeting-ready prototype remains the priority.

## Supporting repository skills

- `../mobile-camera/SKILL.md`
- `../motion-ui/SKILL.md`
- `../vision-menu-classifier/SKILL.md`

## Handoff

Every implementation handoff should include: commit/PR, what is functional, environment/config needed, tests executed, known limitations, and exact next dependency.
