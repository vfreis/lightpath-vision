# A2 Frontend Experience — final polish / handoff para A4

## Estado desta entrega

Branch: `agent/a2-final-polish`, criada diretamente da `main` já reconciliada pelo Tech Lead.

O frontend preserva a arquitetura canônica React + Vite + TypeScript + Motion e não altera a stack `api/`.

## Implementado / preservado

- jornada mobile-first: home -> câmera traseira ou galeria -> preview -> análise -> `success | inconclusive | error` -> nova análise;
- câmera via `getUserMedia`, preferindo `facingMode: environment`, agora com estado de câmera pronta, shutter bloqueado antes de `videoWidth` válido e microflash de captura;
- câmera mais imersiva em composição próxima de 9:16, mantendo galeria e fechamento acessíveis a uma mão;
- normalização local da imagem antes do upload;
- shared image transition via `layoutId="pizza-photo"` entre preview, análise e resultado;
- scan visual, stages de análise, spring/transições e microinterações de toque;
- stagger de ingredientes e sinais de qualidade no resultado;
- `MotionConfig reducedMotion="user"` + fallback CSS `prefers-reduced-motion`;
- safe areas iOS e ajuste específico para largura <= 370 px;
- logo oficial verificado da La Braciera carregado pelo overlay `frontend/src/brand.css`;
- quando a API devolve `referenceImage`, o resultado agora exibe um bloco de **Referência oficial** com a imagem verificada do catálogo;
- `Powered by LightPath` permanece secundário.

## API / segurança

O único valor público de integração é:

`VITE_API_BASE_URL=https://<host-https-temporario>`

O client envia exclusivamente:

`POST {VITE_API_BASE_URL}/api/v1/analyze`

`OPENAI_API_KEY` não é lida, referenciada ou exposta pelo frontend. A integração também rejeita base HTTP fora de `localhost`/`127.0.0.1`, evitando mixed content acidental no GitHub Pages.

A URL HTTPS temporária Hostinger ainda não foi fornecida nesta execução. Assim que existir, A4 deve definir apenas `VITE_API_BASE_URL` no ambiente de build/Pages; nenhum código precisa ser alterado para trocar o host.

## Brand / assets

A `main` recebeu o logo oficial verificado e um overlay de imagens oficiais de referência para pizzas. O A2 usa esses assets existentes sem reivindicar que a paleta neutra atual seja o brand book oficial. `styles.css` mantém tokens conservadores e direção visual premium/fogo/forno somente como atmosfera, até existirem tokens oficiais completos verificados.

## Gate técnico para A4

1. CI `QA` deve executar `npm install`, typecheck/test/build da API, build do frontend e secret scan.
2. Definir `VITE_API_BASE_URL` com a URL HTTPS temporária Hostinger.
3. Confirmar backend com `OPENAI_API_KEY` somente server-side e CORS permitindo `https://vfreis.github.io`.
4. Validar `POST /api/v1/analyze` em `success`, `inconclusive`, erros HTTP, falha OpenAI e offline.
5. Smoke físico em Safari iOS e Chrome Android: câmera traseira, galeria, orientação, safe area, 360 px e reduced motion.
6. Verificar carregamento do logo oficial e das referências oficiais em rede móvel/Wi-Fi da apresentação.
7. Manter Demo Segura bloqueada até haver fotos reais pré-validadas pela mesma API com proveniência.

## Definition of done do A2

O código está pronto para integração/deploy assim que a URL HTTPS do backend for conhecida. O único gate externo remanescente ao frontend é a configuração dessa URL e a execução verde do CI/smoke em dispositivos reais.
