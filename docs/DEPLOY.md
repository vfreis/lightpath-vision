# Deploy

## Frontend — GitHub Pages

O workflow de Pages compila `frontend/` com Vite base `/lightpath-vision/`. Configure a Actions variable `VITE_API_BASE_URL` com a origem HTTPS pública do backend, sem barra final, e habilite GitHub Pages com **GitHub Actions** como source.

URL prevista: `https://vfreis.github.io/lightpath-vision/`.

## Backend A3 — host Node.js 22 com HTTPS

O backend canônico está em `api/`.

```bash
cd api
npm install
npm run build
npm start
```

Secrets/env mínimos:
- `OPENAI_API_KEY` somente server-side;
- `ALLOWED_ORIGINS=https://vfreis.github.io` em produção;
- `OPENAI_MODEL`, thresholds e limites conforme `api/.env.example`.

O endpoint consumido pelo frontend é `POST /api/v1/analyze`. Nunca coloque a chave OpenAI em variável `VITE_*`.

## Demo Segura

`frontend/src/demo.ts` começa propositalmente vazio. Só adicione uma amostra depois de: (1) a imagem real estar aprovada/licenciada para a demo; (2) a imagem exata ter passado pela API live; (3) SHA-256, data de validação e proveniência terem sido registrados; (4) o resultado salvo ser a resposta real obtida. Não escreva manualmente uma classificação de sucesso.
