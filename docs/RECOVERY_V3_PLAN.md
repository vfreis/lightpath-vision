# Braciera Vision — Recovery V3

Status de origem: **NO-GO após smoke real**. A classificação testada errou a identidade e também exibiu alternativas sem grounding visual suficiente.

## Mudanças desta recuperação

- `gpt-4.1-mini` preservado.
- catálogo passa a aceitar o domínio real atual: pizza, calzone e dolci; massa sem glúten é metadado de pedido, nunca classe visual;
- pizzas doces permanecem família visual `pizza`;
- referências supervisionadas do cardápio oficial são derivadas em runtime das páginas oficiais e recortadas com Sharp;
- todos os candidatos de rerank precisam de referência visual utilizável;
- se o melhor candidato inicial não tiver referência, o sistema abstém em vez de substituí-lo pela classe grounded mais próxima;
- `inconclusive` nunca expõe shortlist como alternativas;
- em `success`, alternativas só podem aparecer com referência visual e agreement `strong|partial`;
- scores autodeclarados pelo VLM continuam sendo heurísticas internas, nunca probabilidade calibrada.

## Gate de GO

Não reimplantar como versão aprovada sem typecheck/test/build e smoke real. Depois do deploy, validar `/healthz`, catálogo/famílias, carregamento das referências oficiais em runtime, câmera, pizza conhecida, confusion groups, foto ruim, out-of-catalog, calzone e dolci. Toda classificação errada com ground truth confirmado vira hard negative.
