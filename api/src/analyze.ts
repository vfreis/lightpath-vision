import { catalogVersion, enabledBySlug } from "./catalog.js";
import { config } from "./config.js";
import { PROMPT_VERSION } from "./prompt.js";
import type { ConfidenceLabel, ModelDecision, PublicAnalysisResponse } from "./schemas.js";
import { uniqueStrings } from "./util.js";

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.90) return "high";
  if (score >= config.MATCH_THRESHOLD) return "medium";
  return "low";
}

function safeAlternatives(decision: ModelDecision, predictedPizzaId: string | null) {
  const seen = new Set<string>();
  const result: PublicAnalysisResponse["alternatives"] = [];
  for (const candidate of [...decision.alternatives].sort((a, b) => b.confidence - a.confidence)) {
    if (candidate.pizzaId === predictedPizzaId || seen.has(candidate.pizzaId)) continue;
    const item = enabledBySlug.get(candidate.pizzaId);
    if (!item) continue;
    seen.add(candidate.pizzaId);
    result.push({
      pizzaId: item.slug,
      pizzaName: item.displayName,
      confidenceScore: null
    });
    if (result.length === 3) break;
  }
  return result;
}

export function finalizeModelDecision(requestId: string, decision: ModelDecision): PublicAnalysisResponse {
  const predicted = decision.predictedPizzaId ? enabledBySlug.get(decision.predictedPizzaId) : undefined;
  const warnings = [...decision.warnings];

  const nextBest = decision.alternatives
    .filter((candidate) => candidate.pizzaId !== decision.predictedPizzaId && enabledBySlug.has(candidate.pizzaId))
    .sort((a, b) => b.confidence - a.confidence)[0];

  const margin = nextBest ? decision.confidence - nextBest.confidence : 1;
  const invalidId = Boolean(decision.predictedPizzaId && !predicted);
  const lowConfidence = decision.confidence < config.MATCH_THRESHOLD;
  const ambiguous = margin < config.MIN_TOP_MARGIN;
  const mustBeInconclusive = decision.status === "inconclusive" || !predicted || invalidId || lowConfidence || ambiguous;

  if (invalidId) warnings.push("O modelo retornou um ID fora do catálogo permitido; o resultado foi bloqueado.");
  if (lowConfidence) warnings.push("Evidência visual insuficiente para uma classificação segura no conjunto da demo.");
  if (ambiguous) warnings.push("Os principais candidatos ficaram visualmente próximos; o resultado foi marcado como inconclusivo.");
  warnings.push("A confiança numérica ainda não é calibrada; o MVP expõe apenas uma faixa qualitativa.");
  warnings.push("Os sinais de qualidade são experimentais e não representam critérios oficiais da La Braciera.");

  if (mustBeInconclusive) {
    return {
      requestId,
      status: "inconclusive",
      pizzaId: null,
      pizzaName: null,
      confidenceLabel: lowConfidence ? "low" : "unavailable",
      confidenceScore: null,
      confidenceCalibrated: false,
      alternatives: safeAlternatives(decision, null),
      ingredients: [],
      referenceImage: null,
      qualitySignals: decision.qualitySignals,
      evidence: decision.evidence,
      warnings: uniqueStrings(warnings),
      nutritionSource: null,
      meta: { promptVersion: PROMPT_VERSION, catalogVersion }
    };
  }

  return {
    requestId,
    status: "success",
    pizzaId: predicted.slug,
    pizzaName: predicted.displayName,
    confidenceLabel: confidenceLabel(decision.confidence),
    confidenceScore: null,
    confidenceCalibrated: false,
    alternatives: safeAlternatives(decision, predicted.slug),
    ingredients: predicted.ingredients ?? [],
    referenceImage: predicted.referenceImages[0] ?? null,
    qualitySignals: decision.qualitySignals,
    evidence: decision.evidence,
    warnings: uniqueStrings(warnings),
    nutritionSource: null,
    meta: { promptVersion: PROMPT_VERSION, catalogVersion }
  };
}
