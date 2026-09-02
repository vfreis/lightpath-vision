# A2 Frontend Experience — câmera + premium mobile / handoff para A4

## Branch desta rodada

`agent/a2-camera-premium-v2`, criada diretamente da `main` atual após o deploy single-domain Hostinger e o recognition playbook v2.

## Câmera — padrão Dermaly transportado

O fluxo agora segue o padrão robusto já comprovado no Dermaly, sem carregar lógica clínica:

- `<video autoPlay playsInline muted>`;
- `onCanPlay` controla `cameraReady`;
- shutter bloqueado enquanto a câmera não estiver pronta;
- estado visual de loading enquanto o stream prepara;
- stream anterior sempre é encerrado antes de novo `getUserMedia`;
- câmera traseira (`environment`) permanece default;
- botão de alternância `environment <-> user` reinicia o stream;
- retry explícito após erro;
- mensagens específicas para permission denied, câmera inexistente, câmera ocupada, constraints incompatíveis e bloqueio de segurança/HTTPS;
- fallback para `video: true` quando a câmera solicitada não puder ser satisfeita.

## Captura guiada / image-quality gate no client

A câmera orienta o usuário a:

- manter a pizza inteira dentro do guia circular;
- posicionar a câmera aproximadamente paralela à mesa/top-down ou oblíquo leve;
- usar luz uniforme;
- segurar firme no momento do shutter.

Antes de consolidar a foto, `frontend/src/lib/camera.ts` compara dois frames pequenos e baratos no browser. A heurística bloqueia apenas sinais muito ruins: resolução insuficiente, pouca luz, exposição extrema, movimento forte entre frames ou detalhe visual severamente baixo. A função é reduzir blur/corte ruim antes do upload, não reconhecer/classificar produto no browser.

Upload/galeria continua primeiro-classe e passa pelo mesmo `normalizeImage` usado pela câmera.

## UX / motion

- experiência mobile-first quase full-screen para câmera;
- shared image transition `layoutId="pizza-photo"` entre preview/análise/resultado;
- microflash de captura e scale curto no shutter;
- guia da câmera respira apenas quando `ready`;
- scan + stages continuam explicitamente como feedback de UX, não representação literal do processamento;
- ingredientes e sinais entram em stagger curto;
- referência oficial é exibida quando `referenceImage` está disponível;
- `MotionConfig reducedMotion="user"` + CSS `prefers-reduced-motion` removem movimento não essencial;
- safe areas e targets de toque preservados;
- layout ajustado para 360–380 px e telas baixas.

## Brand / favicon

- logo light oficial verificado continua aplicado via `frontend/src/brand.css`;
- o mesmo asset oficial CDN foi aplicado como `favicon` e `apple-touch-icon` em `frontend/index.html`;
- direção editorial usa foto/produto, forno/brasa e alto contraste, mas **não declara HEX ou tipografia como oficiais**, porque esses tokens exatos ainda não estão verificados;
- `Powered by LightPath` permanece secundário.

## API / segurança

A `main` atual serve frontend e API no mesmo domínio Hostinger. `frontend/src/lib/api.ts` usa same-origin por default e chama:

`POST /api/v1/analyze`

`VITE_API_BASE_URL` continua opcional para ambientes separados. Nenhuma `OPENAI_API_KEY` é usada no browser.

## Arquivos alterados

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/src/lib/camera.ts` (novo)
- `frontend/index.html`
- `docs/A2_FRONTEND_HANDOFF.md`

## Gate A4

1. Fazer build/typecheck real do frontend no runner disponível.
2. Testar a URL Hostinger real em Safari iOS e Chrome Android.
3. Validar: abrir câmera, permission denied, retry, alternar câmera, loading/ready, shutter e galeria.
4. Testar captura com tremor proposital, baixa luz e foto nítida para garantir que a heurística ajuda sem bloquear capturas normais.
5. Confirmar orientação da foto e upload normalizado.
6. Executar `success`, `inconclusive`, falha de rede/OpenAI e item fora do domínio sem fallback fictício.
7. Confirmar favicon/logo e referência oficial em rede móvel real.
8. Manter GO de reconhecimento separado do GO de câmera: reconhecimento exige evals/calibração conforme `07_VISION_RECOGNITION_PLAYBOOK`.
