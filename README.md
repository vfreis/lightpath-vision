# Braciera Vision

Protótipo comercial mobile-first de visão computacional para a La Braciera.

## Integração final

- `frontend/`: experiência React + Vite + TypeScript + Motion consolidada pelo A4 a partir dos requisitos/handoff do A2.
- `api/`: backend Node 22 + TypeScript do A3, integrado sem alterar seus guardrails.
- `docs/A2_FRONTEND_HANDOFF.md`: evidência/handoff original do A2.
- `docs/API_CONTRACT.md`: contrato canônico do A3.
- `docs/QA_GO_NO_GO.md`: gate final do A4.

A jornada é câmera traseira ou galeria → preview/normalização → análise real → `success` ou `inconclusive`; falhas de rede/OpenAI permanecem `error`. O frontend nunca recebe `OPENAI_API_KEY`.

## Local

```bash
npm install
npm --workspace @lightpath/braciera-vision-api run build
OPENAI_API_KEY=... npm --workspace @lightpath/braciera-vision-api start
VITE_API_BASE_URL=http://localhost:8787 npm --workspace frontend run dev
```

## Demo honesty

`inconclusive` é um comportamento correto. A Demo Segura permanece vazia até existir imagem real aprovada, hash/proveniência e resultado obtido pela mesma API. Nenhuma classificação bem-sucedida é criada manualmente.

## Brand gate

O handoff final do A1 ainda não estava disponível no fechamento A4. Por isso a UI conserva tokens neutros, explicitamente não oficiais, e aguarda assets/tokens verificados antes de ser apresentada como fidelidade visual final da La Braciera.
