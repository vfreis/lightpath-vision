import assert from "node:assert/strict";
import test from "node:test";
import { finalizeHierarchicalDecision } from "../src/analyze.js";
import { enabledBySlug } from "../src/catalog.js";
import { assessRerank, prepareShortlist } from "../src/recognition.js";
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
      { itemId: "calabresa", heuristicScore: 0.65, referenceAgreement: "unavailable", evidenceFor: ["embutido"], evidenceAgainst: ["creme não explicado"] },
      { itemId: "casteloes", heuristicScore: 0.51, referenceAgreement: "unavailable", evidenceFor: ["queijo e embutido"], evidenceAgainst: ["complexidade extra"] }
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
  const prepared = prepareShortlist(triage({
    shortlist: [{ itemId: "zozzona", heuristicScore: 0.84, reasons: ["embutido e creme"] }]
  }));
  const ids = prepared.items.map((item) => item.slug);
  assert.deepEqual(ids, ["zozzona", "calabresa", "casteloes"]);
});

test("shortlist removes IDs outside routed family/catalog", () => {
  const prepared = prepareShortlist(triage({
    shortlist: [
      { itemId: "nutella-lindt-brownie", heuristicScore: 0.95, reasons: ["inválido para pizza salgada"] },
      { itemId: "zozzona", heuristicScore: 0.84, reasons: ["embutido e creme"] },
      { itemId: "calabresa", heuristicScore: 0.75, reasons: ["embutido"] }
    ]
  }));
  assert.equal(prepared.items.some((item) => item.slug === "nutella-lindt-brownie"), false);
});

test("reference-grounded separated rerank may be accepted without exposing a probability", () => {
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
});

test("close candidates force abstention", () => {
  const shortlist = ["zozzona", "calabresa", "casteloes"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const ambiguous = rerank({
    ranking: [
      { itemId: "zozzona", heuristicScore: 0.84, referenceAgreement: "strong", evidenceFor: ["compatível"], evidenceAgainst: [] },
      { itemId: "calabresa", heuristicScore: 0.80, referenceAgreement: "unavailable", evidenceFor: ["muito semelhante"], evidenceAgainst: [] },
      { itemId: "casteloes", heuristicScore: 0.50, referenceAgreement: "unavailable", evidenceFor: [], evidenceAgainst: [] }
    ]
  });
  const assessment = assessRerank(ambiguous, shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("top_margin_below_policy"));
});

test("class without an official positive reference cannot be accepted by the current conservative policy", () => {
  const ids = ["margherita", "margherita-verace", "margherita-burrata"];
  const shortlist = ids.map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const noReference: RerankDecision = {
    status: "matched",
    selectedId: "margherita",
    selectedHeuristicScore: 0.94,
    runnerUpId: "margherita-verace",
    runnerUpHeuristicScore: 0.60,
    ranking: [
      { itemId: "margherita", heuristicScore: 0.94, referenceAgreement: "unavailable", evidenceFor: ["perfil visual compatível"], evidenceAgainst: [] },
      { itemId: "margherita-verace", heuristicScore: 0.60, referenceAgreement: "unavailable", evidenceFor: [], evidenceAgainst: [] },
      { itemId: "margherita-burrata", heuristicScore: 0.45, referenceAgreement: "unavailable", evidenceFor: [], evidenceAgainst: ["sem burrata central"] }
    ],
    decisionEvidence: ["ranking interno"],
    contradictions: [],
    warnings: []
  };
  const assessment = assessRerank(noReference, shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("selected_class_missing_official_reference"));
});

test("model-selected ID outside shortlist is always blocked", () => {
  const shortlist = ["zozzona", "calabresa", "casteloes"].map((id) => enabledBySlug.get(id)!).filter(Boolean);
  const assessment = assessRerank(rerank({ selectedId: "caprese" }), shortlist);
  assert.equal(assessment.accepted, false);
  assert.ok(assessment.reasons.includes("selected_id_missing_or_invalid"));
});
