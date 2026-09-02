import { enabledBySlug, enabledCatalogForFamily, type MenuItem } from "./catalog.js";
import {
  abstentionPolicy,
  confusionSetsForIds,
  effectivePolicyFor,
  expandWithConfusionSets,
  relevantHardNegatives,
  type HardNegative
} from "./recognition-context.js";
import { hasSupervisedReference } from "./reference-store.js";
import type { ProductFamily, RerankDecision, TriageDecision } from "./schemas.js";

const supportedFamilies = new Set<ProductFamily>(["pizza", "calzone", "dolci"]);

export type PreparedShortlist = {
  items: MenuItem[];
  hardNegatives: HardNegative[];
  abstentionReasons: string[];
};

export function isSupportedRecognitionFamily(family: ProductFamily): boolean {
  return supportedFamilies.has(family);
}

export function hasRemoteOfficialReference(item: MenuItem): boolean {
  return item.referenceImages.some((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
}

export function hasOfficialReference(item: MenuItem): boolean {
  return hasRemoteOfficialReference(item) || hasSupervisedReference(item.slug);
}

export function assessReferenceBudget(shortlist: MenuItem[], maxReferenceImages: number): string[] {
  if (!shortlist.length) return ["shortlist_has_no_official_references"];
  const ungrounded = shortlist.filter((item) => !hasOfficialReference(item));
  if (ungrounded.length > 0) return ["shortlist_has_ungrounded_candidates"];
  if (shortlist.length > maxReferenceImages) return ["reference_budget_insufficient"];
  return [];
}

export function prepareShortlist(triage: TriageDecision): PreparedShortlist {
  const reasons: string[] = [];
  if (triage.imageQuality.decision !== "pass") {
    reasons.push(`image_quality_${triage.imageQuality.decision}`);
    return { items: [], hardNegatives: [], abstentionReasons: reasons };
  }
  if (!isSupportedRecognitionFamily(triage.family)) {
    reasons.push(`family_${triage.family}`);
    return { items: [], hardNegatives: [], abstentionReasons: reasons };
  }

  const familyItems = enabledCatalogForFamily(triage.family);
  const allowed = new Map(familyItems.map((item) => [item.slug, item]));
  const initialCandidates = triage.shortlist
    .filter((candidate) => allowed.has(candidate.itemId))
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  const initial = [...new Set(initialCandidates.map((candidate) => candidate.itemId))];
  if (initial.length !== triage.shortlist.length) reasons.push("shortlist_invalid_or_duplicate_ids_removed");

  const topCandidate = initial[0] ? allowed.get(initial[0]) : null;
  if (topCandidate && !hasOfficialReference(topCandidate)) {
    reasons.push("top_shortlist_candidate_ungrounded");
    return {
      items: initial.slice(0, 5).map((id) => allowed.get(id)).filter((item): item is MenuItem => Boolean(item)),
      hardNegatives: [],
      abstentionReasons: reasons
    };
  }

  const groundedInitial = initial.filter((id) => {
    const item = allowed.get(id);
    return Boolean(item && hasOfficialReference(item));
  });
  if (groundedInitial.length !== initial.length) reasons.push("ungrounded_lower_candidates_removed");

  let expanded = expandWithConfusionSets(groundedInitial, triage.family, 5)
    .filter((id) => {
      const item = allowed.get(id);
      return Boolean(item && hasOfficialReference(item));
    });

  let negatives = relevantHardNegatives(expanded, triage.family);
  for (const record of negatives) {
    for (const id of [record.expectedId, record.predictedId]) {
      const item = id ? allowed.get(id) : null;
      if (id && item && hasOfficialReference(item) && !expanded.includes(id) && expanded.length < 5) {
        expanded.push(id);
      }
    }
  }

  expanded = [...new Set(expanded)].slice(0, 5);
  negatives = relevantHardNegatives(expanded, triage.family);

  if (expanded.length < 3) reasons.push("shortlist_below_minimum_3");
  if (expanded.length > 5) reasons.push("shortlist_above_maximum_5");

  return {
    items: expanded.map((id) => allowed.get(id)).filter((item): item is MenuItem => Boolean(item)),
    hardNegatives: negatives,
    abstentionReasons: reasons
  };
}

export type AcceptanceAssessment = {
  accepted: boolean;
  selected: MenuItem | null;
  rankedItems: MenuItem[];
  reasons: string[];
  referenceGrounded: boolean;
  effectiveMinHeuristicScore: number;
  effectiveMinMargin: number;
};

export function assessRerank(decision: RerankDecision, shortlist: MenuItem[]): AcceptanceAssessment {
  const reasons: string[] = [];
  const shortlistIds = new Set(shortlist.map((item) => item.slug));
  const ranking = decision.ranking
    .filter((candidate) => shortlistIds.has(candidate.itemId))
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  if (ranking.length !== decision.ranking.length) reasons.push("rerank_returned_id_outside_shortlist");

  const selected = decision.selectedId && shortlistIds.has(decision.selectedId)
    ? enabledBySlug.get(decision.selectedId) ?? null
    : null;
  const selectedRank = selected ? ranking.find((candidate) => candidate.itemId === selected.slug) : undefined;
  const runnerUp = selected ? ranking.find((candidate) => candidate.itemId !== selected.slug) : ranking[0];

  const policy = effectivePolicyFor(shortlistIds);
  const score = selectedRank?.heuristicScore ?? 0;
  const margin = selectedRank ? score - (runnerUp?.heuristicScore ?? 0) : 0;
  const hasReference = Boolean(selected && hasOfficialReference(selected));
  const referenceAgreement = selectedRank?.referenceAgreement ?? "unavailable";
  const acceptedReferenceAgreement = policy.acceptedReferenceAgreement.includes(referenceAgreement);

  if (decision.status !== "matched") reasons.push("model_rerank_inconclusive");
  if (!selected || !selectedRank) reasons.push("selected_id_missing_or_invalid");
  if (selectedRank && ranking[0]?.itemId !== selectedRank.itemId) reasons.push("selected_id_not_top_ranked");
  if (score < policy.minHeuristicScore) reasons.push("heuristic_score_below_policy");
  if (margin < policy.minMargin) reasons.push("top_margin_below_policy");
  if (decision.contradictions.length > policy.maxContradictions) reasons.push("too_many_contradictions");
  if (policy.requireOfficialReferenceForAcceptedMatch && !hasReference) reasons.push("selected_class_missing_official_reference");
  if (hasReference && !acceptedReferenceAgreement) reasons.push("official_reference_agreement_insufficient");
  if (shortlist.length < 3 || shortlist.length > 5) reasons.push("shortlist_size_outside_3_to_5");
  if (shortlist.some((item) => !hasOfficialReference(item))) reasons.push("shortlist_contains_ungrounded_candidate");

  return {
    accepted: reasons.length === 0,
    selected,
    rankedItems: ranking.map((candidate) => enabledBySlug.get(candidate.itemId)).filter((item): item is MenuItem => Boolean(item)),
    reasons,
    referenceGrounded: hasReference && acceptedReferenceAgreement,
    effectiveMinHeuristicScore: policy.minHeuristicScore,
    effectiveMinMargin: policy.minMargin
  };
}

export function recognitionContextSummary(ids: string[]) {
  return {
    confusionSetIds: confusionSetsForIds(ids).map((set) => set.id),
    abstentionPolicyVersion: abstentionPolicy.version,
    calibrationStatus: abstentionPolicy.calibrationStatus,
    scoreSemantics: abstentionPolicy.scoreSemantics
  };
}
