import { catalogVersion, enabledBySlug, type MenuItem } from "./catalog.js";
import { abstentionPolicy } from "./recognition-context.js";
import { assessRerank } from "./recognition.js";
import { PROMPT_VERSION } from "./prompt.js";
import type { ConfidenceLabel, HierarchicalDecision, PublicAnalysisResponse, TriageDecision } from "./schemas.js";
import { uniqueStrings } from "./util.js";

function shortlistItems(decision: HierarchicalDecision): MenuItem[] {
  return decision.shortlistIds
    .map((id) => enabledBySlug.get(id))
    .filter((item): item is MenuItem => Boolean(item));
}

function qualitySignalsFromTriage(triage: TriageDecision): PublicAnalysisResponse["qualitySignals"] {
  const form = triage.fingerprint.form.slice(0, 2).join("; ");
  const coverage = triage.fingerprint.coveragePattern.slice(0, 2).join("; ");
  return {
    shape: {
      state: form ? "neutral" : "unknown",
      observation: form || "Forma não usada como critério operacional nesta etapa."
    },
    bake: {
      state: "unknown",
      observation: "Assamento não é avaliado como conformidade no pipeline de identidade."
    },
    crust: {
      state: "unknown",
      observation: "Cornicione não é aprovado/reprovado pelo pipeline de reconhecimento."
    },
    toppingDistribution: {
      state: coverage ? "neutral" : "unknown",
      observation: coverage || "Distribuição de cobertura não visível de forma suficiente."
    },
    expectedIngredients: {
      state: "unknown",
      observation: "Presença de ingredientes é evidência de identidade, não critério oficial de qualidade."
    }
  };
}

function alternatives(decision: HierarchicalDecision, selectedId: string | null): PublicAnalysisResponse["alternatives"] {
  const rankedIds = decision.rerank
    ? [...decision.rerank.ranking].sort((a, b) => b.heuristicScore - a.heuristicScore).map((candidate) => candidate.itemId)
    : decision.shortlistIds;

  const seen = new Set<string>();
  const result: PublicAnalysisResponse["alternatives"] = [];
  for (const id of rankedIds) {
    if (id === selectedId || seen.has(id)) continue;
    const item = enabledBySlug.get(id);
    if (!item) continue;
    seen.add(id);
    result.push({ pizzaId: item.slug, pizzaName: item.displayName, confidenceScore: null });
    if (result.length === 3) break;
  }
  return result;
}

function confidenceLabel(decision: HierarchicalDecision, selectedId: string | null): ConfidenceLabel {
  if (!selectedId || !decision.rerank) return decision.triage.imageQuality.decision === "pass" ? "low" : "unavailable";
  const selectedRank = decision.rerank.ranking.find((candidate) => candidate.itemId === selectedId);
  if (selectedRank?.referenceAgreement === "strong" && decision.rerank.contradictions.length === 0) return "high";
  return "medium";
}

export function finalizeHierarchicalDecision(requestId: string, decision: HierarchicalDecision): PublicAnalysisResponse {
  const shortlist = shortlistItems(decision);
  const assessment = decision.rerank ? assessRerank(decision.rerank, shortlist) : null;
  const accepted = Boolean(assessment?.accepted && decision.abstentionReasons.length === 0);
  const selected = accepted ? assessment?.selected ?? null : null;
  const warnings = [
    ...decision.triage.warnings,
    ...(decision.rerank?.warnings ?? []),
    ...(decision.rerank?.contradictions ?? []),
    ...decision.abstentionReasons.map((reason) => `Abstention: ${reason}.`),
    "Scores do VLM são heurísticas internas e não probabilidades calibradas.",
    "Calibração permanece pendente até execução do test set versionado; probabilidade pública é null.",
    "Sinais de qualidade permanecem separados da identidade e não representam critérios oficiais da La Braciera."
  ];

  const evidence = decision.rerank?.decisionEvidence.length
    ? decision.rerank.decisionEvidence
    : [...decision.triage.fingerprint.distinctiveSignals, ...decision.triage.imageQuality.observations].slice(0, 6);

  const recognition: PublicAnalysisResponse["recognition"] = {
    family: decision.triage.family,
    imageQuality: decision.triage.imageQuality,
    observedFingerprint: decision.triage.fingerprint,
    shortlist: shortlist.map((item) => ({ itemId: item.slug, itemName: item.displayName })),
    referenceGrounded: accepted ? decision.referenceGrounded : false,
    hardNegativeIds: decision.hardNegativeIds,
    abstentionReasons: accepted ? [] : decision.abstentionReasons,
    calibrationStatus: "pending_eval",
    calibratedProbability: null
  };

  if (!accepted || !selected) {
    return {
      requestId,
      status: "inconclusive",
      pizzaId: null,
      pizzaName: null,
      confidenceLabel: confidenceLabel(decision, null),
      confidenceScore: null,
      confidenceCalibrated: false,
      alternatives: alternatives(decision, null),
      ingredients: [],
      referenceImage: null,
      qualitySignals: qualitySignalsFromTriage(decision.triage),
      evidence,
      warnings: uniqueStrings(warnings),
      nutritionSource: null,
      recognition,
      meta: {
        promptVersion: PROMPT_VERSION,
        catalogVersion,
        abstentionPolicyVersion: abstentionPolicy.version
      }
    };
  }

  return {
    requestId,
    status: "success",
    pizzaId: selected.slug,
    pizzaName: selected.displayName,
    confidenceLabel: confidenceLabel(decision, selected.slug),
    confidenceScore: null,
    confidenceCalibrated: false,
    alternatives: alternatives(decision, selected.slug),
    ingredients: selected.ingredients ?? [],
    referenceImage: selected.referenceImages[0] ?? null,
    qualitySignals: qualitySignalsFromTriage(decision.triage),
    evidence,
    warnings: uniqueStrings(warnings),
    nutritionSource: null,
    recognition,
    meta: {
      promptVersion: PROMPT_VERSION,
      catalogVersion,
      abstentionPolicyVersion: abstentionPolicy.version
    }
  };
}
