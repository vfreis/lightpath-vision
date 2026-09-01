# A1 — Brand & Dataset Handoff

Data: 2026-09-01

## Estado canônico

- O escopo é **36/36 pizzas reconciliadas**, não 6–10.
- `data/menu.json` contém 31 salgadas + 5 doces e mantém `recognitionEnabled=true` em todas as 36.
- `confidenceTier` e `availabilityStatus` do freeze do Tech Lead foram preservados.
- Cobertura total não autoriza classificação forçada: baixa evidência, conflito visual, foto ruim ou item fora do catálogo devem retornar `inconclusive`.

## Auditoria do catálogo

O catálogo foi revisado contra as superfícies públicas oficiais atuais e fontes secundárias já aceitas no freeze. As seis classes de destaque com descrição e foto individuais oficiais foram enriquecidas diretamente em `referenceImages`:

- `zozzona`
- `bastarda`
- `caprese`
- `nutella-lindt-brownie`
- `provola-croccante-di-parma`
- `cuore-di-napoli`

A Caprese foi normalizada para a composição explicitamente publicada na superfície oficial atual: base de muçarela, tomate fresco, pesto de azeitona e manjericão.

Os itens Tier B continuam habilitados e permanecem explicitamente `current_listed_unverified` quando aplicável; não foram artificialmente promovidos a Tier A. `nocciola-chocolat-du-jour` permanece `availability_conflict`.

## Referências visuais

`data/reference-images.json` continua sendo o overlay runtime consumido pelo backend. `data/menu.json` agora também carrega inline as seis URLs oficiais verificadas, tornando a proveniência visível no próprio catálogo.

`data/reference-image-audit.json` registra o estado das 36 classes. Regra: uma página HTML, um post genérico ou uma página composta do cardápio não é cadastrada como foto individual de SKU. O cardápio oficial completo publica 20 páginas-imagens e serve como evidência de menu, mas não deve ser tratado como 36 fotos individuais.

Há um sinal oficial suplementar para **Pancetta e Patate** na experiência atual da La Braciera. Como o freeze canônico solicitado é exatamente 36 classes, A1 não adicionou silenciosamente uma 37ª classe; A4/Tech Lead deve resolver esse conflito de catálogo antes do freeze da reunião.

## Brand

`data/brand.json` é o registro operacional de marca verificável.

Asset confirmado:

- Logo light oficial: `https://experiencia.labraciera.com.br/cdn/shop/files/logo-light-D1h8MQw-_1.webp?v=1786366284&width=1100`

A UI pode usar esse asset preservando proporção e área de respiro. Cores HEX e famílias/pesos tipográficos exatos **não foram declarados** porque não foi possível comprová-los por CSS/brandbook de forma segura. Não transformar amostragem visual em token oficial.

Sinais de marca confirmados: pizza napolitana premium; tradição/técnica italiana; fogo e forno como centro da experiência; ingredientes selecionados; fotografia de produto protagonista; tecnologia LightPath secundária à marca do cliente.

## Handoff A2 — Frontend

1. Consumir catálogo/API; não manter lista paralela de sabores.
2. Exibir foto de referência somente quando `referenceImage` vier preenchida; usar estado neutro quando não houver asset individual verificado.
3. Usar o logo light oficial já registrado.
4. Não apresentar HEX/fonte aproximados como identidade oficial.
5. Manter `Powered by LightPath` discreto.

## Handoff A3 — Backend/AI

1. Allowlist = todas as 36 entradas com `recognitionEnabled=true`.
2. Ingredientes exibidos vêm exclusivamente do dataset, nunca do texto livre do modelo.
3. `referenceImages` é evidência auxiliar; ausência de foto individual não remove a classe do catálogo.
4. Preservar thresholds/margem e `inconclusive` para classes visualmente próximas.
5. Tratar `confidenceTier` como proveniência do catálogo, não como probabilidade do modelo.
6. Não usar a comunicação antiga de “30 sabores” como validação de cardinalidade.

## Handoff A4 — Integration & QA

1. Gate obrigatório: validar todas as 36 classes com fotos reais, incluindo pares visualmente próximos.
2. Separar cobertura de catálogo de cobertura de referências: atualmente 6/36 têm asset individual oficial direto verificável.
3. Montar Demo Segura apenas com fotos cuja proveniência seja conhecida e que tenham passado pela mesma API LIVE.
4. Confirmar disponibilidade da Nocciola por unidade antes de usá-la na apresentação.
5. Resolver o conflito `Pancetta e Patate` versus freeze de 36 antes de declarar menu congelado.
6. Não considerar ausência de referência visual como autorização para fallback fictício.

## Fontes primárias

- https://labraciera.com.br/cardapio
- https://labraciera.com.br/cardapio/completo
- https://labraciera.com.br/sobre
- https://experiencia.labraciera.com.br/
- https://experiencia.labraciera.com.br/pages/quem-somos

## Resultado A1

Dataset permanece 36/36 habilitado, proveniência foi endurecida, referências individuais oficiais verificadas foram incorporadas ao catálogo, brand asset verificável foi formalizado e lacunas restantes estão explicitamente marcadas em vez de preenchidas com dados inventados.
