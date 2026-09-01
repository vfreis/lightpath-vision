# A4 Integration & QA — Go / No-Go

## Integração concluída no código

- O frontend consolidado atende ao fluxo/handoff A2: câmera traseira, galeria, preview/refazer, normalização local, Motion/shared image, scan, reduced-motion, safe areas e estados success/inconclusive/error.
- O backend canônico é o `api/` entregue pelo A3: Responses API + Structured Outputs/Zod, `store:false`, catálogo fechado, threshold + margem, CORS, rate limit, requestId, normalização Sharp e erros reais sem fallback.
- O adapter do frontend foi ajustado ao contrato final A3: `POST /api/v1/analyze`, error `{code,message,retryable}`, confiança numérica não calibrada não é exibida como probabilidade, e qualitySignals estruturados são renderizados sem reinterpretar como aprovação oficial.
- O backend A4 duplicado foi removido para existir uma única implementação canônica.
- `docs/A2_FRONTEND_HANDOFF.md` e o contrato A3 foram preservados no `main`.

## Casos cobertos por implementação/guardrails

1. Pizza habilitada + separação suficiente → `success`.
2. Sabores visualmente próximos → margem mínima pode converter para `inconclusive`.
3. Foto ruim/baixa evidência → prompt exige `inconclusive`.
4. Pizza fora do catálogo/non-pizza → `inconclusive`; ID não habilitado é bloqueado server-side.
5. Confiança baixa → threshold server-side transforma em `inconclusive`.
6. Falha de rede → frontend mostra erro explícito.
7. OpenAI quota/erro/timeout → erro HTTP real e nenhum resultado fictício.

## Validações executadas nesta sessão

- O A2 registrou parsing TypeScript/checagem estrita com shims e scan de secrets OK, mas sem bundle real por indisponibilidade do registry.
- O A3 registrou guardrails e workflow, porém o GitHub Actions não recebeu runner (`runner_id=0`) e não executou steps.
- O A4 reproduziu o mesmo bloqueio: workflows QA e Pages são criados, mas jobs encerram antes de qualquer step, com `runner_id=0`/steps vazios. Isso é gate de infraestrutura GitHub Actions, não evidência de teste de aplicação falhando.
- A4 executou localmente apenas os testes do backend provisório anterior (5/5) e syntax check Node; esse backend foi depois substituído pelo backend canônico A3, portanto esses 5 testes não contam como validação do A3.

## GO / NO-GO atual

**NO-GO para apresentar como demo final LIVE + DEMO SEGURA.** O código está integrado, mas faltam gates externos/empíricos obrigatórios:

1. GitHub Actions precisa efetivamente alocar runner e concluir typecheck/test/build; Pages ainda não foi publicado com sucesso.
2. Backend A3 precisa ser publicado em HTTPS com `OPENAI_API_KEY` server-side e CORS para `https://vfreis.github.io`; depois configurar `VITE_API_BASE_URL` no build do Pages.
3. A1 precisa entregar assets/tokens oficiais e imagens de referência verificadas; a UI atual é deliberadamente neutra.
4. Demo Segura precisa receber fotos reais pré-validadas pela mesma API, com hash/proveniência; não existe fixture de sucesso fictícia.
5. Smoke físico ainda deve ser executado em Safari iOS e Chrome Android, incluindo câmera, galeria, rotação, permissão negada, offline, retake e largura 360 px.
6. Threshold/margem devem ser ensaiados com fotos reais antes de interpretar confiança como desempenho calibrado.

Até esses gates fecharem, a URL prevista do Pages não deve ser anunciada como demo funcional.
