import { catalogVersion, enabledBySlug, type MenuItem } from "./catalog.js";
import { buildQualityContract, QUALITY_CALIBRATION_STATUS } from "./quality-contract.js";
import { abstentionPolicy } from "./recognition-context.js";
import { QUALITY_SIGNAL_CONTRACT_VERSION, TRAINING_BUNDLE_QUALITY_VERSION } from "./quality-signals.js";
import { assessRerank } from "./recognition.js";
import { PROMPT_VERSION } from "./prompt.js";
import type { ConfidenceLabel, HierarchicalDecision, PublicAnalysisResponse, TriageDecision } from "./schemas.js";
import { uniqueStrings } from "./util.js";

function shortlistItems(decision: HierarchicalDecision): MenuItem[] {
  return decision.shortlistIds
    .map((id) => enabledBySlug.get(id))
    .filter((item): item is MenuItem => Boolean(item));
}

function qualitySignalsFromDecision(decision: HierarchicalDecision): PublicAnalysisResponse["qualitySignals"] {
  const signals = decision.observableSignals;
  const shapeObserved = signals.shape.state === "observed";
  const crustObserved = signals.crust.state === "observed";
  const bakeObserved = signals.leopardSpotting.state === "observed";
  const distributionObserved = signals.radialDistribution.state === "observed";
  const semanticObserved = signals.semanticCues.state === "observed";

  return {
    shape: {
      state: shapeObserved ? "neutral" : "unknown",
      observation: signals.shape.note
    },
    bake: {
      state: bakeObserved ? "neutral" : "unknown",
      observation: signals.leopardSpotting.note
    },
    crust: {
      state: crustObserved ? "neutral" : "unknown",
      observation: signals.crust.note
    },
    toppingDistribution: {
      state: distributionObserved ? "neutral" : "unknown",
      observation: signals.radialDistribution.note
    },
    expectedIngredients: {
      state: semanticObserved ? "neutral" : "unknown",
      observation: signals.semanticCues.note
    }
  };
}

function alternatives(decision: HierarchicalDecision, selectedId: string): PublicAnalysisResponse["alternatives"] {
  if (!decision.rerank) return [];
  const rankedIds = [...decision.rerank.ranking]
    .sort((a, b) => b.heuristicScore - a.heuristicScore)
    .map((candidate) => candidate.itemId);

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

function publicRecognition(
  decision: HierarchicalDecision,
  shortlist: MenuItem[],
  accepted: boolean
): PublicAnalysisResponse["recognition"] {
  return {
    family: decision.triage.family,
    imageQuality: decision.triage.imageQuality,
    observedFingerprint: decision.triage.fingerprint,
    // Weak candidates are kept internal for evals but never exposed on an inconclusive public response.
    shortlist: accepted ? shortlist.map((item) => ({ itemId: item.slug, itemName: item.displayName })) : [],
    referenceGrounded: accepted ? decision.referenceGrounded : false,
    hardNegativeIds: decision.hardNegativeIds,
    abstentionReasons: accepted ? [] : decision.abstentionReasons,
    calibrationStatus: "pending_eval",
    calibratedProbability: null
  };
}

function commonMeta(): PublicAnalysisResponse["meta"] {
  return {
    promptVersion: PROMPT_VERSION,
    catalogVersion,
    abstentionPolicyVersion: abstentionPolicy.version,
    qualitySignalContractVersion: QUALITY_SIGNAL_CONTRACT_VERSION,
    trainingBundleQualityVersion: TRAINING_BUNDLE_QUALITY_VERSION,
    qualityCalibrationStatus: QUALITY_CALIBRATION_STATUS
  };
}

export function finalizeHierarchicalDecision(requestId: string, decision: HierarchicalDecision): PublicAnalysisResponse {
  const shortlist = shortlistItems(decision);
  const assessment = decision.rerank ? assessRerank(decision.rerank, shortlist) : null;
  const accepted = Boolean(assessment?.accepted && decision.abstentionReasons.length === 0);
  const selected = accepted ? assessment?.selected ?? null : null;
  const quality = buildQualityContract(decision, selected, accepted);
  const warnings = [
    ...decision.triage.warnings,
    ...(decision.rerank?.warnings ?? []),
    ...(decision.rerank?.contradictions ?? []),
    ...decision.abstentionReasons.map((reason) => `Abstention: ${reason}.`),
    "Scores do VLM são heurísticas internas e não probabilidades calibradas.",
    "Calibração de reconhecimento permanece pendente até execução do test set versionado; probabilidade pública é null.",
    "quality_status descreve somente uma leitura experimental da POC; qualidade operacional não está calibrada."
  ];

  const evidence = decision.rerank?.decisionEvidence.length
    ? decision.rerank.decisionEvidence
    : [...decision.triage.fingerprint.distinctiveSignals, ...decision.triage.imageQuality.observations].slice(0, 6);

  const recognition = publicRecognition(decision, shortlist, accepted);
  const legacyQualitySignals = qualitySignalsFromDecision(decision);

  if (!accepted || !selected) {
    return {
      requestId,
      status: "inconclusive",
      family: decision.triage.family,
      recognitionStatus: "inconclusive",
      predictedItem: null,
      reference: null,
      observableSignals: decision.observableSignals,
      quality_status: quality.qualityStatus,
      quality_notes: quality.qualityNotes,
      pizzaId: null,
      pizzaName: null,
      confidenceLabel: confidenceLabel(decision, null),
      confidenceScore: null,
      confidenceCalibrated: false,
      alternatives: [],
      ingredients: [],
      referenceImage: null,
      qualitySignals: legacyQualitySignals,
      evidence,
      warnings: uniqueStrings(warnings),
      nutritionSource: null,
      recognition,
      meta: commonMeta()
    };
  }

  const referenceImage = selected.referenceImages[0] ?? null;
  return {
    requestId,
    status: "success",
    family: decision.triage.family,
    recognitionStatus: "recognized",
    predictedItem: { itemId: selected.slug, displayName: selected.displayName },
    reference: referenceImage ? { imageUrl: referenceImage, role: "identity_reference" } : null,
    observableSignals: decision.observableSignals,
    quality_status: quality.qualityStatus,
    quality_notes: quality.qualityNotes,
    pizzaId: selected.slug,
    pizzaName: selected.displayName,
    confidenceLabel: confidenceLabel(decision, selected.slug),
    confidenceScore: null,
    confidenceCalibrated: false,
    alternatives: alternatives(decision, selected.slug),
    ingredients: selected.ingredients ?? [],
    referenceImage,
    qualitySignals: legacyQualitySignals,
    evidence,
    warnings: uniqueStrings(warnings),
    nutritionSource: null,
    recognition,
    meta: commonMeta()
  };
}
