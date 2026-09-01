# A4 / Tech Lead Integration & QA — Go / No-Go

## Integração concluída no código

- Frontend: câmera traseira, galeria, preview/refazer, normalização local, Motion/shared image, scan, reduced-motion, safe areas e estados `success|inconclusive|error`.
- Backend canônico: `api/`, com Responses API + Structured Outputs/Zod, `store:false`, threshold + margem, CORS, rate limit, requestId, normalização Sharp e erros reais sem fallback.
- Catálogo canônico `data/menu.json`: **36 pizzas**, todas com `recognitionEnabled=true`.
- Overlay verificado atual: logo oficial La Braciera + seis imagens oficiais de referência (Zozzona, Bastarda, Caprese, Nutella/Lindt/Brownie, Provola & Croccante Di Parma e Cuore Di Napoli).
- Hostinger root deploy preparado: Node `22.x`, `npm run build`, `npm start`, porta default `3000`.
- Frontend só marca LIVE como pronto depois que `/healthz` informa exatamente 36 classes e OpenAI configurada.
- Demo Segura possui manifest gerado por validação real; o browser verifica SHA-256 e reexecuta a API LIVE, nunca usando resultado salvo como fallback.

## Harness A4 de homologação

`scripts/smoke-api.mjs` valida a URL HTTPS real da Hostinger:

1. `/healthz`: `status=ok`, 36 classes, OpenAI configurada.
2. CORS para `https://vfreis.github.io`.
3. `/api/v1/catalog`: 36 classes e referências oficiais.
4. Erro `image_required` sem fallback.
5. Foto válida de baixa informação → `inconclusive`.
6. Pizza havaiana fora do catálogo → `inconclusive`.
7. Referências oficiais visualmente distintas → SKU esperado.
8. Caprese/Cuore Di Napoli → SKU correto ou `inconclusive`, nunca classificação errada forçada.

`scripts/validate-demo-samples.mjs` só gera `frontend/src/demo-samples.json` quando a imagem oficial exata retorna `success` para o SKU esperado na API LIVE. Registra hash, timestamp, origem da API, proveniência e resposta real.

## Estado operacional observado em 2026-09-01

- O repositório GitHub ainda informa `has_pages=false`; portanto não há frontend Pages homologado/publicado.
- As execuções recentes de GitHub Actions observadas continuam terminando antes de qualquer step (`runner_id=0`/steps vazios). Isso não prova falha do código, mas também não fornece build/deploy verde.
- A URL HTTPS temporária da aplicação Node.js Hostinger não foi encontrada no Vault, no repositório nem no contexto recuperável desta execução; sem essa URL não é possível executar os testes live acima nem configurar `VITE_API_BASE_URL` com um valor real.
- O manifest `frontend/src/demo-samples.json` permanece vazio até a API real ser testada.
- Não houve acesso, nesta execução, a um Safari iOS e Chrome Android físicos para o smoke obrigatório.

## GO / NO-GO atual

**NO-GO.** Não promover a demo como homologada até fechar simultaneamente:

1. URL temporária Hostinger HTTPS acessível; `/healthz` deve provar 36 classes + OpenAI.
2. `npm run smoke:api` deve passar usando OpenAI real, referências oficiais, negativos e CORS.
3. `VITE_API_BASE_URL` deve apontar para essa origem e GitHub Pages deve estar efetivamente publicado.
4. `npm run demo:validate` + `WRITE_DEMO=1` deve gerar apenas amostras reais que passaram na API.
5. LIVE e DEMO SEGURA devem passar no frontend publicado, sem fallback sintético.
6. Smoke físico em Safari iPhone e Chrome Android: câmera traseira, galeria, orientação, compressão, permissão negada, retake, offline/falha de rede, `success`, `inconclusive` e erro.
7. Falha OpenAI real deve continuar como erro HTTP/UI real; não induzir falha deliberadamente em produção apenas para obter evidência.

O procedimento operacional exato está em `docs/HOSTINGER_GO_LIVE.md`.
