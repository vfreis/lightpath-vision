# API Contract — Braciera Vision A3 / Quality Signal Contract v1

## POST `/api/v1/analyze`

`Content-Type: multipart/form-data`; campo obrigatório `image` (JPEG/PNG/WebP, limite default 8 MB).

O endpoint mantém compatibilidade com os campos legados (`pizzaId`, `pizzaName`, `referenceImage`, `qualitySignals`) e adiciona o contrato explícito da POC:

- `family`
- `recognitionStatus`
- `predictedItem`
- `reference`
- `observableSignals`
- `quality_status`
- `quality_notes`

## Pipeline

1. normalização da imagem;
2. extração local de sinais alinhados ao bundle de treino (`model_bundle_v1` / feature schema `braciera_features_v2_no_family_leakage`);
3. quality gate de captura;
4. family router `pizza | calzone | dolci | other | inconclusive`;
5. fingerprint + shortlist 3–5;
6. reference-budget gate;
7. reranking com `gpt-4.1-mini`, referências oficiais e sinais locais do bundle como evidência complementar;
8. selective classification / abstention;
9. contrato de leitura experimental de qualidade.

O classificador sklearn bootstrap exportado não é promovido a decisão autônoma no Node porque os evals reais não validaram seus thresholds para produção. O bundle é integrado como **observable scaffold/evidência**, e `gpt-4.1-mini` permanece a camada complementar semântica/referencial. Isso evita transformar métricas bootstrap em decisão operacional.

## Exemplo — `success`

```json
{
  "requestId": "uuid",
  "status": "success",
  "family": "pizza",
  "recognitionStatus": "recognized",
  "predictedItem": {
    "itemId": "zozzona",
    "displayName": "Zozzona"
  },
  "reference": {
    "imageUrl": "https://...",
    "role": "identity_reference"
  },
  "observableSignals": {
    "crust": {
      "state": "observed",
      "crustWidthProxy": 0.22,
      "edgeDensity": 0.14,
      "centerToCrustValueDelta": -48,
      "note": "Cornicione visível para leitura experimental de largura, textura e contraste."
    },
    "leopardSpotting": {
      "state": "observed",
      "darkRatio": 0.08,
      "note": "Pontos escuros no anel externo medidos como proxy visual de leoparding/ponto de forno."
    },
    "texture": { "state": "observed", "grayStd": 62, "edgeDensity": 0.22, "note": "..." },
    "blur": { "state": "observed", "laplacianVariance": 950, "note": "..." },
    "shape": { "state": "observed", "areaRatio": 0.70, "circularity": 0.77, "aspectRatio": 1.02, "note": "..." },
    "radialDistribution": { "state": "observed", "centerValue": 160, "midValue": 150, "crustValue": 205, "centerToCrustValueDelta": -45, "note": "..." },
    "semanticCues": {
      "state": "observed",
      "ratios": { "red": 0.15, "green": 0.03, "yellow": 0.04, "dark": 0.06, "cream": 0.12, "brownToast": 0.07, "highSaturation": 0.28 },
      "cues": ["vermelhos/tomate aparentes", "queijo/cremes claros aparentes"],
      "note": "Cores semânticas aparentes; ingredientes ocultos não são inferidos."
    },
    "meta": {
      "source": "training_bundle_observable_scaffold",
      "bundleVersion": "quality-signal-profile.v1",
      "calibratedQuality": false
    }
  },
  "quality_status": "experimental_compatible",
  "quality_notes": [
    "Cornicione visível: a POC consegue ler largura, textura e contraste do anel externo.",
    "A leitura visual da POC está compatível com a referência usada nesta comparação, sem certificar qualidade operacional.",
    "Qualidade operacional ainda não calibrada com fotos boas/ruins validadas pela La Braciera."
  ],
  "confidenceScore": null,
  "confidenceCalibrated": false
}
```

## Estados de qualidade permitidos

Enquanto não houver dataset de pizzas boas/ruins validado pelo cliente, **somente**:

- `not_calibrated`: leitura existe, mas falta grounding/calibração suficiente para comparação experimental;
- `experimental_compatible`: sinais observáveis e referência estão visualmente compatíveis na POC; NÃO significa aprovação;
- `experimental_attention`: há sinal observável que merece conferência de montagem/foto/referência; NÃO significa reprovação;
- `inconclusive`: reconhecimento ou captura não permitem uma leitura útil.

Nunca usar `approved`, `rejected`, `certified`, `aprovada`, `reprovada`, `certificada` ou equivalentes como veredito. A qualidade operacional permanece `not_calibrated` até existir dataset aprovado/reprovado pelo cliente e calibração medida.

## ObservableSignals

O scaffold local usa os mesmos conceitos exportados no treinamento:

- `crust`: cornicione, largura proxy, densidade de borda e contraste centro/borda;
- `leopardSpotting`: dark ratio no anel externo como proxy de pontos de forno;
- `texture`: dispersão de cinza e densidade de bordas;
- `blur`: variância de Laplaciano proxy;
- `shape`: ocupação, circularidade e aspecto;
- `radialDistribution`: centro / meio / cornicione e delta de luminosidade;
- `semanticCues`: razões de vermelho, verde, amarelo, escuro, creme, tostado e alta saturação.

Essas features são **observáveis**, não labels de qualidade.

## Inconclusive e privacidade da shortlist

Se o reconhecimento for inconclusivo:

- `predictedItem = null`;
- `reference = null`;
- `alternatives = []`;
- `recognition.shortlist = []`.

A shortlist fraca continua disponível apenas internamente para eval/hard-negative mining e não vaza como sugestão ao frontend.

## Calibração de reconhecimento

`heuristicScore` do VLM continua interno e não é probabilidade. A API mantém `confidenceScore=null`, `confidenceCalibrated=false` e `recognition.calibratedProbability=null` até calibração real.

## Guardrails

1. `gpt-4.1-mini` permanece fixado.
2. O bundle bootstrap não certifica identidade nem qualidade sozinho.
3. Ingredientes e referência vêm do catálogo, nunca do modelo.
4. Observable signals não autorizam inferir ingrediente oculto.
5. Reconhecimento inconclusivo não mostra alternativas fracas.
6. Falha OpenAI continua erro real; nenhum fallback fictício.
7. Qualidade só pode virar veredito operacional após dataset cliente boa/ruim + calibração + gate explícito.
