# A2 Frontend Experience — handoff para A4

## Implementado

- React + Vite + TypeScript, `base: /lightpath-vision/` e workflow de GitHub Pages.
- Jornada mobile-first: home -> câmera traseira ou galeria -> preview -> análise -> success/inconclusive/error -> nova análise.
- Câmera via `getUserMedia`, `facingMode: environment`, shutter em canvas e feedback de permissão/indisponibilidade.
- Normalização local com `createImageBitmap`, orientação `from-image`, resize para maior aresta de 1600 px e JPEG 0.86.
- `FormData` para `POST {VITE_API_BASE_URL}/analyze`; nenhum segredo no client.
- Motion for React com `AnimatePresence`, `layoutId="captured-pizza"`, spring no resultado, stagger, scan visual e `MotionConfig reducedMotion="user"`.
- Safe areas iOS, targets mobile, estados de loading, erro e inconclusive.

## Contrato esperado do A3

Resposta JSON compatível com:

- `status`: `success | inconclusive | error`
- `pizzaId`, `pizzaName`
- `confidenceLabel`, `confidenceScore`
- `alternatives[]`
- `ingredients[]`
- `referenceImage`
- `qualitySignals[]` com `{ label, state, detail }`
- `warnings[]`
- `nutritionSource`
- `message`

O frontend não cria fallback fictício: sem `VITE_API_BASE_URL`, falha explicitamente e direciona o usuário para tentar novamente.

## Integração A1

`src/styles.css` usa **tokens neutros provisórios explicitamente marcados como fallback**, não como cores oficiais. A4 deve substituir `--ink`, `--muted`, `--bg`, `--surface`, `--line`, `--accent`, `--accent-strong` e tipografia pelos tokens/assets verificados que A1 entregar. Logo oficial também deve substituir o wordmark tipográfico temporário assim que estiver no repo.

## Validação executada por A2

- Parsing sintático de `src/App.tsx`, `src/main.tsx` e `vite.config.ts` com TypeScript 5.8.3: OK.
- Checagem TypeScript estrita adicional com shims locais mínimos para React/Motion/Vite, cobrindo a lógica e tipos próprios do app: OK.
- `package.json` e `tsconfig.json` validados como JSON.
- Varredura por literais óbvios de segredo: OK; nenhuma credencial encontrada no código do frontend.
- O ambiente local do agente não tem acesso de rede ao registry npm/GitHub, portanto dependências reais não puderam ser instaladas localmente.
- Foi criado o workflow `Frontend check` para executar `npm install && npm run build` no PR. As tentativas do GitHub Actions encerraram antes de qualquer step, com `runner_id: 0` e lista de steps vazia. Assim, **não houve falha de compilação observada**; há um bloqueio/configuração de infraestrutura do Actions que A4 deve resolver ou contornar antes do merge.

## Checklist A4

1. Rebase/merge A1 e A3; resolver somente tokens/assets e adapter se o contrato final divergir.
2. Definir `VITE_API_BASE_URL` no ambiente de build do Pages (URL pública segura, nunca chave).
3. Fazer o workflow `Frontend check` obter runner e ficar verde; alternativamente rodar `npm install && npm run build` em ambiente com registry disponível.
4. Verificar o bundle produzido por strings de segredo/credenciais.
5. Testar HTTPS em Chrome Android e Safari iOS: permissão, câmera traseira, galeria, orientação, 360 px, safe area e reduced motion.
6. Validar `success`, `inconclusive`, HTTP 4xx/5xx, offline e resposta inválida.
7. Confirmar CORS do backend para o domínio final do Pages.
8. Substituir placeholders visuais pelos assets oficiais do A1 antes da reunião.
