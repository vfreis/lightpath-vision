# Braciera Vision API

Backend mínimo e isolado do protótipo. A chave OpenAI existe somente neste serviço.

## Executar localmente

```bash
cd api
cp .env.example .env
npm install
npm run dev
```

Requer Node.js 22+. `healthz` e o catálogo podem subir sem chave, mas `POST /api/v1/analyze` retorna `openai_not_configured` até `OPENAI_API_KEY` existir no `.env`/secret manager.

## Endpoints

- `GET /healthz` — liveness sem secrets; informa apenas se OpenAI está configurada.
- `GET /api/v1/catalog` — somente classes atualmente habilitadas.
- `POST /api/v1/analyze` — `multipart/form-data`, campo `image`.

JPEG, PNG e WebP são aceitos; a imagem é validada, auto-rotacionada, limitada ao maior lado configurado, convertida para JPEG e tem metadata removida pelo re-encode antes de seguir para a OpenAI.

## Segurança

- nunca usar `OPENAI_API_KEY` no frontend nem em `VITE_*`;
- `ALLOWED_ORIGINS` deve conter apenas origins aprovadas, por exemplo `https://vfreis.github.io`;
- limite de upload e rate limit são server-side;
- a resposta do modelo é validada por Zod e o `pizzaId` é conferido novamente contra o catálogo habilitado;
- falha/quota/OpenAI inválida retorna erro real, sem mock/fallback;
- `store: false` é enviado ao Responses API.

## Catálogo A1 e referências visuais

A API procura, nessa ordem: `MENU_CATALOG_PATH`, `data/menu.json`, `../data/menu.json`, e por fim o bootstrap do A3. Quando A1 entregar `menu.json`, prefira apontar `MENU_CATALOG_PATH` para o arquivo canônico ou colocá-lo em `data/menu.json`.

O bootstrap contém apenas seis classes Nível A do Vault para destravar integração. `referenceImages` ainda está vazio; portanto `referenceImage` retorna `null` até o handoff real do A1. Não há URL fictícia. `catalogVersion` é calculado a partir do SHA-256 do JSON carregado, então muda automaticamente quando o dataset é atualizado.

Quando o catálogo possuir referências HTTP(S), o classificador envia no máximo `MAX_REFERENCE_IMAGES` (default 8), usando a primeira referência disponível por SKU. Isso limita custo/latência e prepara o backend para o handoff do A1. Referências locais/relativas são ignoradas pela chamada OpenAI até existir uma estratégia explícita de publicação/upload dessas imagens.

## Confiança

O modelo retorna uma heurística interna para aplicar threshold e margem entre candidatos. Como isso ainda não foi calibrado em dataset real, a API deliberadamente devolve `confidenceScore: null`, `confidenceCalibrated: false` e apenas `confidenceLabel`. Isso evita apresentar falsa precisão no MVP.
