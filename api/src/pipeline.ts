import { config } from "./config.js";
import { rerankWithOpenAI, triageWithOpenAI } from "./openai.js";
import { extractObservableSignals } from "./quality-signals.js";
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
  abstentionReasons: string[],
  observableSignals: HierarchicalDecision["observableSignals"]
): HierarchicalDecision {
  return {
    triage,
    rerank: null,
    shortlistIds,
    hardNegativeIds,
    abstentionReasons,
    referenceGrounded: false,
    observableSignals
  };
}

export async function classifyHierarchically(image: Buffer): Promise<HierarchicalDecision> {
  // Training bundle integration is deliberately evidence-first: the exported observable
  // scaffold is computed locally before GPT. The bootstrap sklearn decision thresholds are
  // not imported because real-domain evals did not validate them as autonomous decisions.
  const observableSignals = await extractObservableSignals(image);
  const triage = await triageWithOpenAI(image, observableSignals);
  const prepared = prepareShortlist(triage);
  const shortlistIds = prepared.items.map((item) => item.slug);
  const hardNegativeIds = prepared.hardNegatives.map((record) => record.id);
  const triageAbstention = terminalTriageReasons(prepared.abstentionReasons);

  if (triageAbstention.length > 0) {
    return terminalDecision(triage, shortlistIds, hardNegativeIds, triageAbstention, observableSignals);
  }

  const referenceAbstention = assessReferenceBudget(prepared.items, config.MAX_REFERENCE_IMAGES);
  if (referenceAbstention.length > 0) {
    return terminalDecision(triage, shortlistIds, hardNegativeIds, referenceAbstention, observableSignals);
  }

  const rerank = await rerankWithOpenAI(image, triage, prepared.items, prepared.hardNegatives, observableSignals);
  const assessment = assessRerank(rerank, prepared.items);

  return {
    triage,
    rerank,
    shortlistIds,
    hardNegativeIds,
    abstentionReasons: assessment.accepted ? [] : assessment.reasons,
    referenceGrounded: assessment.referenceGrounded,
    observableSignals
  };
}
