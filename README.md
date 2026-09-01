# Braciera Vision

Sales prototype for La Braciera: mobile-first camera/gallery capture, closed-catalog multimodal recognition and preliminary visual-quality signals.

## Architecture

- `frontend/`: React + Vite + TypeScript + Motion, deployable to GitHub Pages.
- `backend/`: minimal Node/Express API. OpenAI secret stays server-side.
- `docs/API_CONTRACT.md`: stable response contract.
- `docs/QA_GO_NO_GO.md`: A4 gate and test matrix.
- `docs/DEPLOY.md`: deployment instructions.

## Local

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm --workspace backend start
npm --workspace frontend run dev
```

Never place `OPENAI_API_KEY` in a `VITE_*` variable.

## Demo honesty

`inconclusive` is a correct result. Network/OpenAI failures are errors, never synthetic pizza predictions. Safe-demo fixtures are intentionally empty until backed by a real image hash and a real API result.

## Brand gate

The A1 Vault note available during A4 integration contained its initial mission but no completed asset/token handoff. The UI therefore uses an explicitly neutral presentation system and does not claim its colors/fonts as official La Braciera tokens. Replace those presentation tokens only with verified official assets/tokens.
