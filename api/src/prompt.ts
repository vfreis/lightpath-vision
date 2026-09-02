import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MenuItem } from "./catalog.js";
import type { ConfusionSet, HardNegative } from "./recognition-context.js";
import { hasOfficialReference } from "./recognition.js";
import type { TriageDecision } from "./schemas.js";

export const PROMPT_VERSION = "hierarchical-recognition.v3-grounded-menu";

const cache = new Map<string, string>();

function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const candidates = [
    resolve(process.cwd(), `prompts/${name}`),
    resolve(process.cwd(), `api/prompts/${name}`)
  ];
  const path = candidates.find((candidate) => {
    try {
      readFileSync(candidate, "utf8");
      return true;
    } catch {
      return false;
    }
  });
  if (!path) throw new Error(`prompt_not_found:${name}`);
  const value = readFileSync(path, "utf8");
  cache.set(name, value);
  return value;
}

function catalogFacts(items: MenuItem[]) {
  return items.map((item) => ({
    itemId: item.slug,
    itemName: item.displayName,
    aliases: item.aliases,
    family: item.family,
    ingredients: item.ingredients ?? [],
    hasOfficialReference: hasOfficialReference(item)
  }));
}

export function buildTriageSystemPrompt(items: MenuItem[], confusionSets: ConfusionSet[]): string {
  const sets = confusionSets.map(({ id, family, members, discriminators }) => ({ id, family, members, discriminators }));
  return `${loadPrompt("recognition-triage.v2.md")}\n\n## Catálogo permitido\n${JSON.stringify(catalogFacts(items), null, 2)}\n\n## Confusion sets conhecidos\n${JSON.stringify(sets, null, 2)}`;
}

export function buildRerankSystemPrompt(
  items: MenuItem[],
  fingerprint: TriageDecision["fingerprint"],
  confusionSets: ConfusionSet[],
  hardNegatives: HardNegative[]
): string {
  const negatives = hardNegatives.map(({ id, family, expectedId, predictedId, confusionSet, source, observations }) => ({
    id,
    family,
    expectedId,
    predictedId,
    confusionSet,
    source,
    observations
  }));

  return `${loadPrompt("recognition-rerank.v2.md")}\n\n## Regra V3 de grounding visual\nTodos os candidatos desta etapa possuem referência visual oficial/supervisionada enviada na requisição. Compare visualmente cada candidato; não use apenas ingredientes textuais para desempatar.\n\n## Fingerprint observado\n${JSON.stringify(fingerprint, null, 2)}\n\n## Candidatos permitidos nesta etapa\n${JSON.stringify(catalogFacts(items), null, 2)}\n\n## Confusion sets relevantes\n${JSON.stringify(confusionSets, null, 2)}\n\n## Hard negatives confirmados relevantes\n${JSON.stringify(negatives, null, 2)}`;
}
