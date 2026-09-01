# Braciera Vision

Protótipo comercial mobile-first de visão computacional para a La Braciera.

## Integração

- `frontend/`: React + Vite + TypeScript + Motion; câmera traseira, galeria, preview, análise e resultados.
- `api/`: backend Node 22 + TypeScript; OpenAI server-side, catálogo fechado, Structured Outputs e guardrails de `inconclusive`.
- `data/menu.json`: catálogo canônico reconciliado para o protótipo.
- `docs/A2_FRONTEND_HANDOFF.md`: handoff do frontend.
- `docs/API_CONTRACT.md`: contrato canônico da API.
- `docs/QA_GO_NO_GO.md`: gate de QA e apresentação.

A jornada é câmera traseira ou galeria → preview/normalização → análise real → `success` ou `inconclusive`; falhas de rede/OpenAI permanecem `error`. O frontend nunca recebe `OPENAI_API_KEY`.

## Catálogo completo

A decisão de produto vigente é reconhecer **todas as pizzas atualmente reconciliadas no cardápio/listagens correntes**, e não apenas um subconjunto de demo. O `data/menu.json` contém **36 sabores**, todos com `recognitionEnabled: true`.

Cada item preserva fonte, data de reconciliação, `confidenceTier` e estado de disponibilidade. Itens cuja ficha/validade ainda depende de reconciliação oficial permanecem sinalizados; isso não autoriza o modelo a inventar informação.

Cobertura ampla não remove o guardrail: sabores visualmente semelhantes, imagem ruim, pizza fora do catálogo ou evidência insuficiente devem retornar `inconclusive`.

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

O catálogo foi consolidado pelo Tech Lead após a entrega incompleta do A1. Assets oficiais, tipografia/tokens finais e imagens de referência ainda precisam ser incorporados antes de afirmar fidelidade visual completa à marca La Braciera. Até esse gate fechar, a UI usa tokens de apresentação explicitamente neutros.
