import { rerankWithOpenAI, triageWithOpenAI } from "./openai.js";
import { assessRerank, prepareShortlist } from "./recognition.js";
import type { HierarchicalDecision } from "./schemas.js";

function terminalTriageReasons(reasons: string[]): string[] {
  return reasons.filter((reason) =>
    reason.startsWith("image_quality_") ||
    reason.startsWith("family_") ||
    reason === "shortlist_below_minimum_3" ||
    reason === "shortlist_above_maximum_5"
  );
}

export async function classifyHierarchically(image: Buffer): Promise<HierarchicalDecision> {
  const triage = await triageWithOpenAI(image);
  const prepared = prepareShortlist(triage);
  const triageAbstention = terminalTriageReasons(prepared.abstentionReasons);

  if (triageAbstention.length > 0) {
    return {
      triage,
      rerank: null,
      shortlistIds: prepared.items.map((item) => item.slug),
      hardNegativeIds: prepared.hardNegatives.map((record) => record.id),
      abstentionReasons: triageAbstention,
      referenceGrounded: false
    };
  }

  const rerank = await rerankWithOpenAI(image, triage, prepared.items, prepared.hardNegatives);
  const assessment = assessRerank(rerank, prepared.items);

  return {
    triage,
    rerank,
    shortlistIds: prepared.items.map((item) => item.slug),
    hardNegativeIds: prepared.hardNegatives.map((record) => record.id),
    abstentionReasons: assessment.accepted ? [] : assessment.reasons,
    referenceGrounded: assessment.referenceGrounded
  };
}
