# A4 / Tech Lead Integration & QA — Go / No-Go

## Integração concluída no código

- Frontend: câmera traseira, galeria, preview/refazer, normalização local, Motion/shared image, scan, reduced-motion, safe areas e estados `success|inconclusive|error`.
- Backend canônico: `api/`, com Responses API + Structured Outputs/Zod, `store:false`, threshold + margem, CORS, rate limit, requestId, normalização Sharp e erros reais sem fallback.
- Adapter frontend integrado a `POST /api/v1/analyze`.
- Catálogo canônico `data/menu.json`: 36 pizzas reconciliadas, todas com `recognitionEnabled: true`; cobertura ampla mantém `inconclusive` obrigatório para baixa evidência/ambiguidade.
- O Tech Lead corrigiu o entrypoint compilado da API para `dist/src/server.js`.

## Casos cobertos por implementação/guardrails

1. Pizza do catálogo + separação suficiente → `success`.
2. Sabores visualmente próximos → margem mínima pode converter para `inconclusive`.
3. Foto ruim/baixa evidência → `inconclusive`.
4. Pizza fora do catálogo/non-pizza → `inconclusive`; ID inválido é bloqueado server-side.
5. Confiança baixa → `inconclusive`.
6. Falha de rede → erro explícito no frontend.
7. OpenAI quota/erro/timeout → erro real, sem resultado fictício.

## Catálogo / A1

A entrega original do A1 não trouxe o dataset final. O Tech Lead reconciliou o catálogo e criou `data/menu.json` com 36 sabores. Ainda permanecem como gates de conteúdo: imagens oficiais de referência, confirmação final de alguns itens `confidenceTier=B`, disponibilidade da Nocciola e assets/tokens finais de marca.

## Validação automatizada

Os workflows QA e Pages existem, mas as execuções observadas encerraram antes dos steps (`runner_id=0`/steps vazios). Isso não prova falha do código, porém também não comprova build/deploy. Após o merge desta correção, typecheck/test/build e Pages devem ser reexecutados.

## GO / NO-GO atual

**NO-GO para apresentar como demo final LIVE + DEMO SEGURA**, até fechar:

1. QA real: typecheck/test/build executados com sucesso e Pages publicado.
2. Backend HTTPS com `OPENAI_API_KEY` server-side, CORS correto e `VITE_API_BASE_URL` configurado.
3. Assets/tokens La Braciera e referências visuais oficiais incorporados.
4. Demo Segura populada somente com fotos reais pré-validadas pela mesma API, com proveniência.
5. Smoke físico em Safari iOS e Chrome Android: câmera, galeria, rotação, permissão negada, offline, retake e 360 px.
6. Ensaio das 36 classes com fotos reais e calibração de threshold/margem; cobertura completa não implica precisão garantida para classes visualmente semelhantes.

Até esses gates fecharem, a URL do Pages não deve ser anunciada como demo homologada.
