# API Contract — Braciera Vision A3

## GET `/healthz`

Readiness endpoint. Production must report the canonical 36-pizza classifier and whether the OpenAI secret is configured.

```json
{
  "status": "ok",
  "catalogItems": 36,
  "recognitionClasses": 36,
  "expectedRecognitionClasses": 36,
  "openaiConfigured": true,
  "catalogVersion": "sha256:...",
  "port": 3000,
  "node": "22.x.x"
}
```

The API refuses to start if the canonical catalog does not contain exactly 36 items or if fewer/more than 36 classes are `recognitionEnabled=true`.

## GET `/api/v1/catalog`

Returns the complete enabled recognition catalog. For the current prototype, `items` must contain exactly 36 unique pizzas. Ingredients and official reference URLs are server-owned catalog facts.

```json
{
  "status": "success",
  "catalogVersion": "sha256:...",
  "items": [
    {
      "pizzaId": "zozzona",
      "pizzaName": "Zozzona",
      "category": "pizza_salgada",
      "ingredients": ["..."],
      "referenceImage": "https://experiencia.labraciera.com.br/...",
      "confidenceTier": "A",
      "availabilityStatus": "current_listed"
    }
  ]
}
```

## POST `/api/v1/analyze`

`Content-Type: multipart/form-data`

Campo obrigatório:

- `image`: JPEG, PNG ou WebP; máximo configurável, default 8 MB.

### 200 — `success`

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
    { "pizzaId": "caprese", "pizzaName": "Caprese", "confidenceScore": null }
  ],
  "ingredients": ["Pomodoro Italiano", "Fiordillatte"],
  "referenceImage": "https://experiencia.labraciera.com.br/...",
  "qualitySignals": {
    "shape": { "state": "positive", "observation": "..." },
    "bake": { "state": "neutral", "observation": "..." },
    "crust": { "state": "positive", "observation": "..." },
    "toppingDistribution": { "state": "neutral", "observation": "..." },
    "expectedIngredients": { "state": "neutral", "observation": "..." }
  },
  "evidence": ["..."],
  "warnings": ["..."],
  "nutritionSource": null,
  "meta": {
    "promptVersion": "pizza-classifier.v1",
    "catalogVersion": "sha256:..."
  }
}
```

### 200 — `inconclusive`

Mesmo contrato, mas `pizzaId`, `pizzaName` e `referenceImage` são `null`, `ingredients` é `[]`, e alternativas podem ser retornadas. Isso acontece para baixa evidência, ID inválido, pizza fora do catálogo, foto ruim, imagem ambígua ou margem insuficiente entre candidatos.

### Erro

```json
{
  "requestId": "uuid",
  "status": "error",
  "code": "openai_upstream_error",
  "message": "A análise visual falhou no provedor de IA.",
  "retryable": true
}
```

Códigos relevantes: `image_required`, `image_too_large`, `invalid_image`, `unsupported_image_type`, `image_too_small`, `catalog_not_ready`, `origin_not_allowed`, `rate_limited`, `openai_not_configured`, `openai_rate_limited`, `openai_upstream_error`, `openai_request_failed`, `internal_error`.

## Guardrails

1. O modelo recebe as 36 classes canônicas com `recognitionEnabled=true` e não pode retornar item fora delas.
2. O retorno é validado por Structured Outputs/Zod.
3. O servidor rejeita qualquer ID que não esteja no catálogo habilitado.
4. Threshold default: `0.78`; margem mínima para o segundo candidato: `0.10`.
5. Baixa evidência ou candidatos próximos retornam `inconclusive`; cobertura completa do catálogo não autoriza classificação forçada.
6. A heurística numérica do modelo não é exposta como probabilidade calibrada.
7. Ingredientes e `referenceImage` são hidratados pelo servidor a partir do catálogo — nunca aceitos do modelo.
8. Referências verificadas são sobrepostas a partir de `data/reference-images.json`; nenhuma referência ausente é inventada.
9. Sinais de qualidade são observações preliminares, sem aprovação/reprovação.
10. Erro upstream nunca gera classificação falsa.
11. `catalogVersion` é um hash do JSON + overlay de referências carregados, não um rótulo manual.
12. A chamada à OpenAI usa Responses API multimodal, Structured Outputs e `store:false`.

## Hostinger / CORS

O backend canônico é `api/`, mas o deploy Hostinger parte da raiz do monorepo: Node 22.x, build `npm run hostinger:build`, start `npm start`, porta 3000. `OPENAI_API_KEY` deve existir apenas em Environment variables da Hostinger.

Configure `ALLOWED_ORIGINS=https://vfreis.github.io` em produção. CORS trabalha por origin, portanto o path `/lightpath-vision/` não entra nessa variável.

No frontend, a única variável pública necessária é a URL base da API, por exemplo `VITE_API_BASE_URL=https://<backend-host>`. Essa URL não é segredo.
