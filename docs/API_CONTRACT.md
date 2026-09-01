# API Contract — Braciera Vision A3

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
  "referenceImage": null,
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

Mesmo contrato, mas `pizzaId`, `pizzaName` e `referenceImage` são `null`, `ingredients` é `[]`, e alternativas podem ser retornadas. Isso acontece para baixa evidência, ID inválido, imagem ambígua ou margem insuficiente entre candidatos.

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

1. O modelo só recebe classes com `recognitionEnabled=true`.
2. O retorno é validado por Structured Outputs/Zod.
3. O servidor rejeita qualquer ID que não esteja no catálogo habilitado.
4. Threshold default: `0.78`; margem mínima para o segundo candidato: `0.10`.
5. A heurística numérica do modelo não é exposta como probabilidade calibrada.
6. Ingredientes e `referenceImage` são hidratados pelo servidor a partir do catálogo — nunca aceitos do modelo.
7. Sinais de qualidade são observações preliminares, sem aprovação/reprovação.
8. Erro upstream nunca gera classificação falsa.
9. `catalogVersion` é um hash do JSON carregado, não um rótulo manual.

## CORS para GitHub Pages

Configure `ALLOWED_ORIGINS=https://vfreis.github.io` em produção. CORS trabalha por origin, portanto o path `/lightpath-vision/` não entra nessa variável.

No frontend, a única variável pública necessária é a URL base da API, por exemplo `VITE_API_BASE_URL=https://<backend-host>`. Essa URL não é segredo.
