# LightPath Vision — Braciera Vision

Protótipo mobile-first de visão computacional da LightPath Tecnologia para a La Braciera.

## Objetivo do MVP

- fotografar uma pizza pela câmera do celular;
- anexar uma foto existente do dispositivo;
- identificar o sabor dentro de um catálogo controlado da La Braciera;
- exibir confiança, alternativas, ingredientes e referência oficial;
- apresentar uma prévia experimental de sinais de qualidade visual;
- retornar `inconclusive` quando a evidência não for suficiente.

## Arquitetura

```text
Mobile browser
  -> React + Vite + TypeScript (GitHub Pages)
  -> Camera / Gallery + image normalization
  -> secure LightPath API
  -> OpenAI multimodal + structured output
  -> La Braciera catalog / visual references
  -> result UI
```

A chave da OpenAI **nunca** deve estar no frontend ou em variáveis `VITE_*`. O GitHub Pages hospeda somente a aplicação estática; a análise passa por backend separado.

## UX

A experiência deve ser premium, mobile-first e visualmente alinhada à La Braciera. Motion deve ajudar a compreender o fluxo: captura -> análise -> resultado. Usar animações leves de `transform`/`opacity`, shared layout, springs e estados de análise, sempre respeitando `prefers-reduced-motion`.

## Fonte de verdade

Fonte estratégica e de dataset: `vault_vifalqueiro/Projetos/La Braciera`.

Ordem mínima de leitura para agentes:

1. `00_INDEX`
2. `CURRENT_STATE`
3. `01_MASTER_PROJECT`
4. `04_MENU_DATASET`
5. `05_TECH_REFERENCES_AND_SKILLS`
6. `06_UX_MOTION_SPEC`
7. `docs/ARCHITECTURE.md`
8. `docs/RESEARCH_REFERENCES.md`

## Regras do MVP

- mobile first;
- câmera + galeria;
- catálogo conhecido pode ser maior que as classes habilitadas para reconhecimento;
- não forçar classificação;
- sem fallback fictício;
- segredos somente server-side;
- critérios de qualidade são experimentais até calibração com pizzas e padrões aprovados pela La Braciera;
- não alterar o Dermaly; ele serve apenas como referência técnica para padrões já provados.
