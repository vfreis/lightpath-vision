# API Contract — Braciera Vision A3 / Hierarchical Recognition v2

## POST `/api/v1/analyze`

`Content-Type: multipart/form-data`; campo obrigatório `image` (JPEG/PNG/WebP, limite default 8 MB).

O endpoint público continua compatível com o frontend atual. Os campos legados `pizzaId`/`pizzaName` são mantidos por compatibilidade e podem representar item de família `pizza`, `calzone` ou `dolci` quando o catálogo for ampliado.

## Pipeline interno

1. image quality gate;
2. family router: `pizza | calzone | dolci | other | inconclusive`;
3. visual fingerprint observável;
4. shortlist server-validada de 3–5 candidatos;
5. reference-budget gate: deve ser possível enviar ao menos uma referência oficial para cada candidato do shortlist que declara referência;
6. reranking em segunda chamada, apenas com shortlist + referências oficiais disponíveis + hard negatives confirmados relevantes;
7. selective classification / abstention.

Ambas as chamadas usam `gpt-4.1-mini`, Responses API, `store:false` e Structured Outputs/Zod.

## 200 — `success`

```json
{
  "requestId": "uuid",
  "status": "success",
  "pizzaId": "zozzona",
  "pizzaName": "Zozzona",
  "confidenceLabel": "high",
  "confidenceScore": null,
  "confidenceCalibrated": false,
  "alternatives": [
    { "pizzaId": "calabresa", "pizzaName": "Calabresa", "confidenceScore": null }
  ],
  "ingredients": ["Pomodoro Italiano", "Fiordillatte"],
  "referenceImage": "https://...",
  "qualitySignals": {
    "shape": { "state": "neutral", "observation": "..." },
    "bake": { "state": "unknown", "observation": "..." },
    "crust": { "state": "unknown", "observation": "..." },
    "toppingDistribution": { "state": "neutral", "observation": "..." },
    "expectedIngredients": { "state": "unknown", "observation": "..." }
  },
  "evidence": ["..."],
  "warnings": ["..."],
  "nutritionSource": null,
  "recognition": {
    "family": "pizza",
    "imageQuality": { "decision": "pass", "reasonCodes": [], "observations": ["..."] },
    "observedFingerprint": { "distinctiveSignals": ["..."] },
    "shortlist": [
      { "itemId": "zozzona", "itemName": "Zozzona" },
      { "itemId": "calabresa", "itemName": "Calabresa" },
      { "itemId": "casteloes", "itemName": "Castelões" }
    ],
    "referenceGrounded": true,
    "hardNegativeIds": [],
    "abstentionReasons": [],
    "calibrationStatus": "pending_eval",
    "calibratedProbability": null
  },
  "meta": {
    "promptVersion": "hierarchical-recognition.v2",
    "catalogVersion": "sha256:...",
    "abstentionPolicyVersion": "precalibration-v1"
  }
}
```

## 200 — `inconclusive`

Mesmo payload, com `pizzaId`, `pizzaName` e `referenceImage` nulos e `ingredients=[]`. `recognition.abstentionReasons` explica o gate que bloqueou aceitação, por exemplo:

- `image_quality_retry`;
- `family_other` / `family_inconclusive`;
- `shortlist_below_minimum_3`;
- `shortlist_has_no_official_references`;
- `reference_budget_insufficient`;
- `heuristic_score_below_policy`;
- `top_margin_below_policy`;
- `selected_class_missing_official_reference`;
- `official_reference_agreement_insufficient`;
- `too_many_contradictions`.

`inconclusive` é resultado correto; não é erro de API.

## Calibração

Os números `heuristicScore` retornados internamente pelo VLM são usados apenas para ordenação/política seletiva. **Não são probabilidades calibradas.** A API pública mantém `confidenceScore=null`, `confidenceCalibrated=false` e `calibratedProbability=null`.

`data/abstention-policy.json` contém a política versionada. O estado atual é `pending_eval`: os thresholds/margens são valores conservadores de bootstrap e só podem ser chamados de calibrados depois de ajuste no mesmo test set versionado com accepted accuracy, false-positive rate, coverage/inconclusive rate e confusion matrix.

## Confusion sets e hard negatives

- `data/confusion-sets.json`: grupos explícitos de classes parecidas + sinais discriminantes.
- `data/hard-negatives.json`: registry de erros com ground truth confirmado. Registros não confirmados não entram no reranking.
- Hard negative é contraexemplo; nunca vira automaticamente exemplo de treinamento.

## Referências oficiais

A segunda chamada recebe apenas referências oficiais dos candidatos do shortlist. Antes de chamar o reranker, o servidor verifica se `MAX_REFERENCE_IMAGES` comporta pelo menos uma imagem oficial de cada candidato que possui referência. Primeiro é enviada uma referência por candidato; somente o orçamento restante é usado para segunda vista ou hard negatives com imagem. Assim, um candidato nunca é considerado grounded por uma referência que não chegou ao modelo.

Se nenhum candidato do shortlist possui referência oficial, a pipeline abstém antes da segunda chamada. Se o candidato selecionado não possui referência oficial, a política conservadora também abstém em vez de aceitar uma classe sem grounding visual. Nenhuma referência ausente é inventada.

## Guardrails

1. `gpt-4.1-mini` fica pinado como baseline até eval comparativo.
2. CLIP/SigLIP/DINOv2 não fazem parte deste runtime.
3. IDs fora do catálogo/família/shortlist são removidos ou bloqueados server-side.
4. Ingredientes/nome/referenceImage vêm do catálogo, nunca do modelo.
5. Reconhecimento e QA operacional permanecem separados.
6. Falha OpenAI retorna erro real; não há fallback fictício.
7. Mudança de modelo, prompt, policy ou retrieval exige repetir o mesmo test set versionado.

## Erros

Formato permanece:

```json
{
  "requestId": "uuid",
  "status": "error",
  "code": "openai_upstream_error",
  "message": "A análise visual falhou no provedor de IA.",
  "retryable": true
}
```

Códigos incluem `image_required`, `image_too_large`, `invalid_image`, `unsupported_image_type`, `image_too_small`, `catalog_not_ready`, `invalid_shortlist`, `origin_not_allowed`, `rate_limited`, `openai_not_configured`, `openai_invalid_triage`, `openai_invalid_rerank`, `openai_rate_limited`, `openai_upstream_error`, `openai_request_failed` e `internal_error`.
