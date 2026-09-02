import { config } from "./config.js";
import { rerankWithOpenAI, triageWithOpenAI } from "./openai.js";
import { assessReferenceBudget, assessRerank, prepareShortlist } from "./recognition.js";
import type { HierarchicalDecision } from "./schemas.js";

function terminalTriageReasons(reasons: string[]): string[] {
  return reasons.filter((reason) =>
    reason.startsWith("image_quality_") ||
    reason.startsWith("family_") ||
    reason === "shortlist_below_minimum_3" ||
    reason === "shortlist_above_maximum_5"
  );
}

function terminalDecision(
  triage: HierarchicalDecision["triage"],
  shortlistIds: string[],
  hardNegativeIds: string[],
  abstentionReasons: string[]
): HierarchicalDecision {
  return {
    triage,
    rerank: null,
    shortlistIds,
    hardNegativeIds,
    abstentionReasons,
    referenceGrounded: false
  };
}

export async function classifyHierarchically(image: Buffer): Promise<HierarchicalDecision> {
  const triage = await triageWithOpenAI(image);
  const prepared = prepareShortlist(triage);
  const shortlistIds = prepared.items.map((item) => item.slug);
  const hardNegativeIds = prepared.hardNegatives.map((record) => record.id);
  const triageAbstention = terminalTriageReasons(prepared.abstentionReasons);

  if (triageAbstention.length > 0) {
    return terminalDecision(triage, shortlistIds, hardNegativeIds, triageAbstention);
  }

  const referenceAbstention = assessReferenceBudget(prepared.items, config.MAX_REFERENCE_IMAGES);
  if (referenceAbstention.length > 0) {
    return terminalDecision(triage, shortlistIds, hardNegativeIds, referenceAbstention);
  }

  const rerank = await rerankWithOpenAI(image, triage, prepared.items, prepared.hardNegatives);
  const assessment = assessRerank(rerank, prepared.items);

  return {
    triage,
    rerank,
    shortlistIds,
    hardNegativeIds,
    abstentionReasons: assessment.accepted ? [] : assessment.reasons,
    referenceGrounded: assessment.referenceGrounded
  };
}
