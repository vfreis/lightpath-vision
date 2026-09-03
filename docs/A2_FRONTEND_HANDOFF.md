# A2 Frontend Experience — POC quality-first / handoff para A4

## Branch desta rodada

`agent/a2-quality-first-poc`, criada diretamente da `main` atual.

Esta entrega implementa o override canônico de `12_POC_COPY_QUALITY_EXPERIENCE_SPEC` após a reunião de 03/09. O reconhecimento do produto continua evidente, mas a experiência passa a comunicar o valor real discutido com a La Braciera: **padronização visual, montagem e aderência à referência/ficha técnica da casa**.

## Mudança de hierarquia

### Home

- eyebrow: `LA BRACIERA VISION`;
- headline: `Da bancada ao padrão da casa.`;
- CTA principal: `Conferir uma pizza`;
- CTA secundário: `Usar foto da galeria`;
- superfície explica de forma editorial que a POC começa a observar cornicione, ponto de forno, montagem, distribuição da cobertura e referência da casa;
- removidos os cards de “modo LIVE/demo” da superfície principal para reduzir aparência SaaS/dashboard.

### Captura

A câmera robusta existente foi preservada: rear-first, `autoPlay`, `playsInline`, `onCanPlay`, ready/loading, retry, switch camera, preflight de movimento/luz/detalhe e galeria.

A copy passou a falar como conferência de bancada:

- `Enquadre a pizza inteira`;
- cornicione e montagem devem ficar visíveis;
- pouca inclinação, luz homogênea e sem corte;
- estados `Preparando a bancada…`, `Câmera pronta` e `Foto fora do ponto…`.

### Análise / motion

A foto capturada continua o mesmo objeto via `layoutId="pizza-photo"`.

O scanner linear/sci-fi deixou de ser a linguagem principal. A leitura visual agora usa:

- anel de cornicione;
- leitura radial centro → borda;
- marcações discretas de cobertura;
- transição contínua da mesma pizza para o resultado.

Stages de UX, na ordem canônica:

1. `Lendo o cornicione…`
2. `Conferindo o ponto de forno…`
3. `Mapeando a montagem…`
4. `Cruzando ingredientes visuais…`
5. `Comparando com a referência da casa…`
6. `Fechando a leitura…`

As etapas continuam explicitamente narrativas: não afirmam que seis classificadores validados já existem.

## Resultado

O resultado passou a parecer uma ficha de conferência gastronômica, não dashboard:

- `PRODUTO PROVÁVEL` + sabor/tipo em tipografia editorial grande;
- `Leitura do padrão` abaixo do reconhecimento;
- cinco linhas de bancada: `Cornicione`, `Ponto de forno`, `Montagem`, `Distribuição da cobertura`, `Similaridade com referência`;
- observações existentes do backend são reaproveitadas sem promover heurística a certificação;
- `Referência da casa` aparece quando `referenceImage` existe;
- ingredientes conhecidos são contextualizados como `FICHA TÉCNICA · CONTEXTO VISUAL`.

Se o reconhecimento for `inconclusive`, a UI não mostra alternativas fracas. Usa `Essa pizza ainda pede outra olhada.` e orienta nova foto.

## Quality status / anti-overclaim

`frontend/src/types.ts` aceita de forma retrocompatível os campos opcionais:

- `family`;
- `observableSignals`;
- `quality_status`;
- `quality_notes`.

`quality_status` suportado:

`not_calibrated | experimental_compatible | experimental_attention | inconclusive`

Enquanto o backend atual não enviar um status, o frontend assume **`not_calibrated`**.

Regra de produto: quando `quality_status=not_calibrated`, a interface NÃO mostra `APROVADA`, `REPROVADA`, selo verde/vermelho ou wording equivalente. Mostra `Qualidade não calibrada`, observações visuais e aviso de POC.

## POC obrigatória

O selo `POC LightPath · Em treinamento` fica visível no topo. Home possui explicação expansível e o resultado possui aviso explícito:

- reconhecimento e qualidade ainda exigem fotos reais da operação;
- treinamento / machine learning;
- calibração;
- regras da operação La Braciera;
- a POC não deve ser usada como controle operacional;
- a leitura não representa aprovação/reprovação da pizza.

## Acessibilidade / mobile

- câmera e galeria preservadas;
- safe areas iOS;
- alvos de toque confortáveis;
- layout 320–380 px tratado;
- `MotionConfig reducedMotion="user"` preservado;
- CSS `prefers-reduced-motion` desliga guide breathing, leitura radial e transições não essenciais;
- contraste e texto continuam legíveis sem depender dos overlays.

## Brand

Logo/favicons oficiais já presentes na `main` foram preservados. A direção editorial usa fotografia, brasa e matéria-prima, mas não declara HEX/fonte exatos como oficiais enquanto esses tokens não tiverem verificação de brand book.

## API / segurança

Nenhuma mudança na integração segura:

`POST /api/v1/analyze`

A POC continua same-origin no Hostinger por default e não usa `OPENAI_API_KEY` no browser.

## Arquivos desta rodada

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- `frontend/index.html`
- `docs/A2_FRONTEND_HANDOFF.md`

## Gate A4

1. Executar typecheck/build real no runner ou Hostinger.
2. Smoke de câmera e galeria em Safari iOS + Chrome Android.
3. Validar visualmente a continuidade captura → leitura radial/cornicione → resultado.
4. Validar `prefers-reduced-motion` em sistema/navegador.
5. Testar `success` com e sem `referenceImage`, `inconclusive`, falha de rede/OpenAI e foto ruim.
6. Testar payload legado sem `quality_status`: deve cair em `not_calibrated` sem quebrar a UI.
7. Testar payload futuro com todos os quatro valores de `quality_status`.
8. Fazer busca na superfície renderizada para garantir ausência de `APROVADA`/`REPROVADA` quando não calibrado.
9. Confirmar em <=10 segundos que um usuário entende: é POC, está em treinamento, reconhece produto como demonstração, objetivo é padrão da casa e produto final depende da operação real.
10. GO operacional continua proibido até dataset aprovado/reprovado pelo cliente, calibração e regras de qualidade existirem.
