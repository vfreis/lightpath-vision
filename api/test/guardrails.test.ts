import assert from "node:assert/strict";
import test from "node:test";
import { finalizeHierarchicalDecision } from "../src/analyze.js";
import { enabledBySlug } from "../src/catalog.js";
import { assessReferenceBudget, assessRerank, hasOfficialReference, prepareShortlist } from "../src/recognition.js";
import type { HierarchicalDecision, RerankDecision, TriageDecision } from "../src/schemas.js";

const fingerprint: TriageDecision["fingerprint"] = {
  form: ["pizza circular aberta"],
  baseAndCheese: ["base de tomate parcialmente visível", "queijo distribuído"],
  proteins: ["rodelas de embutido visíveis"],
  vegetablesAndHerbs: [],
  creamsAndCenters: ["creme claro em pontos"],
  sweetElements: [],
  coveragePattern: ["cobertura distribuída"],
  distinctiveSignals: ["embutido + creme claro"],
  notVisible: ["ingredientes sob o queijo"]
};

function triage(overrides: Partial<TriageDecision> = {}): TriageDecision {
  return {
    imageQuality: { decision: "pass", reasonCodes: [], observations: ["produto principal bem enquadrado"] },
    family: "pizza",
    fingerprint,
    shortlist: [
      { itemId: "zozzona", heuristicScore: 0.84, reasons: ["embutido e creme"] },
      { itemId: "calabresa", heuristicScore: 0.75, reasons: ["calabresa aparente"] },
      { itemId: "casteloes", heuristicScore: 0.70, reasons: ["calabresa e queijo"] }
    ],
    warnings: [],
    ...overrides
  };
}

function rerank(overrides: Partial<RerankDecision> = {}): RerankDecision {
  return {
    status: "matched",
    selectedId: "zozzona",
    selectedHeuristicScore: 0.92,
    runnerUpId: "calabresa",
    runnerUpHeuristicScore: 0.65,
    ranking: [
      { itemId: "zozzona", heuristicScore: 0.92, referenceAgreement: "strong", evidenceFor: ["referência compatível"], evidenceAgainst: [] },
      { itemId: "calabresa", heuristicScore: 0.65, referenceAgreement: "partial", evidenceFor: ["embutido"], evidenceAgainst: ["creme não explicado"] },
      { itemId: "casteloes", heuristicScore: 0.51, referenceAgreement: "weak", evidenceFor: ["queijo e embutido"], evidenceAgainst: ["complexidade extra"] }
    ],
    decisionEvidence: ["Zozzona tem melhor acordo com referência oficial e sinais discriminantes."],
    contradictions: [],
    warnings: [],
    ...overrides
  };
}

test("quality gate abstains before shortlist/rerank", () => {
  const prepared = prepareShortlist(triage({
    imageQuality: { decision: "retry", reasonCodes: ["blur"], observations: ["imagem desfocada"] },
    family: "inconclusive",
    shortlist: []
  }));
  assert.equal(prepared.items.length, 0);
  assert.ok(prepared.abstentionReasons.includes("image_quality_retry"));
});

test("confusion set preserves the calabresa/casteloes/zozzona neighborhood", () => {
  const prepared = prepareShortlist(triage({ shortlist: [{ itemId: "zozzona", heuristicScore: 0.84, reasons: ["embutido e creme"] }] }));
  assert.deepEqual(prepared.items.map((item) => item.slug), ["zozzona", "calabresa", "casteloes"]);
});

test("shortlist removes IDs outside routed family/catalog", () => {
  const prepared = prepareShortlist(triage({
    shortlist: [
      { itemId: "item-fora-do-catalogo", heuristicScore: 0.95, reasons: ["id inválido"] },
      { itemId: "zozzona", heuristicScore: 0.84, reasons: ["embutido e creme"] },
      { itemId: "calabresa", heuristicScore: 0.75, reasons: ["embutido"] }
    ]
  }));
  assert.equal(prepared.items.some((item) => item.slug === "item-fora-do-catalogo"), false);
});

test("pizza doce remains in pizza family instead of dolci", () => {
  const sweet = enabledBySlug.get("nutella-lindt-brownie");
  assert.equal(sweet?.family, "pizza");
});

test("current menu additions load with their visual families", () => {
  assert.equal(enabledBySlug.get("abbra-cciami")?.family, "pizza");
  assert.equal(enabledBySlug.get("calzone-al-pistacchio")?.family, "calzone");
  assert.equal(enabledBySlug.get("tiramissu")?.family, "dolci");
});

test("an ungrounded top candidate forces abstention instead of substitution", () => {
  const prepared = prepareShortlist(triage({
    shortlist: [
      { itemId: "la-diciannove", heuristicScore: 0.91, reasons: ["aparência semelhante"] },
      { itemId: "zozzona", heuristicScore: 0.86, reasons: ["embutido e creme"] },
      { itemId: "calabresa", heuristicScore: 0.72, reasons: ["embutido"] }
    ]
  }));
  assert.ok(prepared.abstentionReasons.includes("top_shortlist_candidate_ungrounded"));
});

test("supervised official-menu crops ground previously reference-less classes", () => {
  const ids = ["margherita", "margherita-verace", "margherita-burrata"];
  const grounded = ids.map((id) => enabledBySlug.get(id)!).filter(Boolean);
  assert.equal(grounded.every(hasOfficialReference), true);
  assert.deepEqual(assessReferenceBudget(grounded, 2), ["reference_budget_insufficient"]);
  assert.deepEqual(assessReferenceBudget(grounded, 3), []);
});

test("rerank is blocked when any candidate lacks visual grounding", () => {
  const mixed = ["la-diciannove", "zozzona", "calabresa"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  assert.equal(hasOfficialReference(mixed[0]!), false);
  assert.deepEqual(assessReferenceBudget(mixed, 8), ["shortlist_has_ungrounded_candidates"]);
});

test("reference-grounded rerank may be accepted without exposing a probability", () => {
  const shortlist = ["zozzona", "calabresa", "casteloes"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const assessment = assessRerank(rerank(), shortlist);
  assert.equal(assessment.accepted, true);
  assert.equal(assessment.selected?.slug, "zozzona");
  assert.equal(assessment.referenceGrounded, true);

  const decision: HierarchicalDecision = {
    triage: triage(),
    rerank: rerank(),
    shortlistIds: shortlist.map((item) => item.slug),
    hardNegativeIds: [],
    abstentionReasons: [],
    referenceGrounded: true
  };
  const result = finalizeHierarchicalDecision("req-accepted", decision);
  assert.equal(result.status, "success");
  assert.equal(result.pizzaId, "zozzona");
  assert.equal(result.confidenceScore, null);
  assert.equal(result.confidenceCalibrated, false);
  assert.equal(result.recognition.calibrationStatus, "pending_eval");
  assert.equal(result.recognition.calibratedProbability, null);
  assert.deepEqual(result.alternatives.map((item) => item.pizzaId), ["calabresa"]);
});

test("close candidates force abstention and never leak shortlist as alternatives", () => {
  const shortlist = ["zozzona", "calabresa", "casteloes"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const ambiguous = rerank({
    ranking: [
      { itemId: "zozzona", heuristicScore: 0.84, referenceAgreement: "strong", evidenceFor: ["compatível"], evidenceAgainst: [] },
      { itemId: "calabresa", heuristicScore: 0.80, referenceAgreement: "strong", evidenceFor: ["muito semelhante"], evidenceAgainst: [] },
      { itemId: "casteloes", heuristicScore: 0.50, referenceAgreement: "partial", evidenceFor: [], evidenceAgainst: [] }
    ]
  });
  const assessment = assessRerank(ambiguous, shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("top_margin_below_policy"));

  const result = finalizeHierarchicalDecision("req-ambiguous", {
    triage: triage(),
    rerank: ambiguous,
    shortlistIds: shortlist.map((item) => item.slug),
    hardNegativeIds: [],
    abstentionReasons: assessment.reasons,
    referenceGrounded: false
  });
  assert.equal(result.status, "inconclusive");
  assert.deepEqual(result.alternatives, []);
});

test("class without a supervised/direct reference cannot be accepted", () => {
  const ids = ["la-diciannove", "zozzona", "calabresa"];
  const shortlist = ids.map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const decision: RerankDecision = {
    status: "matched",
    selectedId: "la-diciannove",
    selectedHeuristicScore: 0.94,
    runnerUpId: "zozzona",
    runnerUpHeuristicScore: 0.60,
    ranking: [
      { itemId: "la-diciannove", heuristicScore: 0.94, referenceAgreement: "unavailable", evidenceFor: ["perfil visual compatível"], evidenceAgainst: [] },
      { itemId: "zozzona", heuristicScore: 0.60, referenceAgreement: "partial", evidenceFor: [], evidenceAgainst: [] },
      { itemId: "calabresa", heuristicScore: 0.45, referenceAgreement: "weak", evidenceFor: [], evidenceAgainst: [] }
    ],
    decisionEvidence: ["ranking interno"],
    contradictions: [],
    warnings: []
  };
  const assessment = assessRerank(decision, shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("selected_class_missing_official_reference"));
  assert.ok(assessment.reasons.includes("shortlist_contains_ungrounded_candidate"));
});

test("model-selected ID outside shortlist is always blocked", () => {
  const shortlist = ["zozzona", "calabresa", "casteloes"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const assessment = assessRerank(rerank({ selectedId: "caprese" }), shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("selected_id_missing_or_invalid"));
});
