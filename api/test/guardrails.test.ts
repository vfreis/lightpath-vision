import assert from "node:assert/strict";
import test from "node:test";
import { finalizeHierarchicalDecision } from "../src/analyze.js";
import { enabledBySlug } from "../src/catalog.js";
import { assertNoQualityCertification, buildQualityContract } from "../src/quality-contract.js";
import type { ObservableSignals } from "../src/quality-signals.js";
import { assessReferenceBudget, assessRerank, prepareShortlist } from "../src/recognition.js";
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

const observableSignals: ObservableSignals = {
  crust: {
    state: "observed",
    crustWidthProxy: 0.22,
    edgeDensity: 0.14,
    centerToCrustValueDelta: -48,
    note: "Cornicione visível para leitura experimental."
  },
  leopardSpotting: {
    state: "observed",
    darkRatio: 0.08,
    note: "Pontos escuros visíveis no anel externo."
  },
  texture: {
    state: "observed",
    grayStd: 62,
    edgeDensity: 0.22,
    note: "Textura aparente legível."
  },
  blur: {
    state: "observed",
    laplacianVariance: 950,
    note: "Nitidez suficiente para leitura experimental."
  },
  shape: {
    state: "observed",
    areaRatio: 0.7,
    circularity: 0.77,
    aspectRatio: 1.02,
    note: "Forma aparente mensurável."
  },
  radialDistribution: {
    state: "observed",
    centerValue: 160,
    midValue: 150,
    crustValue: 205,
    centerToCrustValueDelta: -45,
    note: "Distribuição radial legível."
  },
  semanticCues: {
    state: "observed",
    ratios: { red: 0.15, green: 0.03, yellow: 0.04, dark: 0.06, cream: 0.12, brownToast: 0.07, highSaturation: 0.28 },
    cues: ["vermelhos/tomate aparentes", "queijo/cremes claros aparentes"],
    note: "Cores semânticas aparentes."
  },
  meta: {
    source: "training_bundle_observable_scaffold",
    bundleVersion: "quality-signal-profile.v1",
    calibratedQuality: false
  }
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

function hierarchical(overrides: Partial<HierarchicalDecision> = {}): HierarchicalDecision {
  return {
    triage: triage(),
    rerank: rerank(),
    shortlistIds: ["zozzona", "calabresa", "casteloes"],
    hardNegativeIds: [],
    abstentionReasons: [],
    referenceGrounded: true,
    observableSignals,
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

test("reference budget requires at least one sendable official reference", () => {
  const noReference = ["margherita", "margherita-verace", "margherita-burrata"]
    .map((id) => enabledBySlug.get(id)!).filter(Boolean);
  assert.deepEqual(assessReferenceBudget(noReference, 8), ["shortlist_has_no_official_references"]);

  const oneReference = ["zozzona", "calabresa", "casteloes"]
    .map((id) => enabledBySlug.get(id)!).filter(Boolean);
  assert.deepEqual(assessReferenceBudget(oneReference, 0), ["reference_budget_insufficient"]);
  assert.deepEqual(assessReferenceBudget(oneReference, 1), []);
});

test("reference-grounded match exposes quality signals but never calibrated probability", () => {
  const result = finalizeHierarchicalDecision("req-accepted", hierarchical());
  assert.equal(result.status, "success");
  assert.equal(result.recognitionStatus, "recognized");
  assert.equal(result.family, "pizza");
  assert.equal(result.predictedItem?.itemId, "zozzona");
  assert.equal(result.pizzaId, "zozzona");
  assert.equal(result.confidenceScore, null);
  assert.equal(result.confidenceCalibrated, false);
  assert.equal(result.recognition.calibratedProbability, null);
  assert.equal(result.observableSignals.meta.calibratedQuality, false);
  assert.equal(result.quality_status, "experimental_compatible");
  assertNoQualityCertification(result.quality_notes);
});

test("recognition inconclusive does not leak weak alternatives or public shortlist", () => {
  const result = finalizeHierarchicalDecision("req-inc", hierarchical({
    abstentionReasons: ["top_margin_below_policy"],
    referenceGrounded: false
  }));
  assert.equal(result.status, "inconclusive");
  assert.equal(result.recognitionStatus, "inconclusive");
  assert.deepEqual(result.alternatives, []);
  assert.deepEqual(result.recognition.shortlist, []);
  assert.equal(result.predictedItem, null);
  assert.equal(result.reference, null);
  assert.equal(result.quality_status, "inconclusive");
});

test("blur or contradiction yields experimental attention, never rejection", () => {
  const blurredSignals: ObservableSignals = {
    ...observableSignals,
    blur: { state: "limited", laplacianVariance: 25, note: "Nitidez limitada." }
  };
  const decision = hierarchical({ observableSignals: blurredSignals });
  const selected = enabledBySlug.get("zozzona") ?? null;
  const quality = buildQualityContract(decision, selected, true);
  assert.equal(quality.qualityStatus, "experimental_attention");
  assertNoQualityCertification(quality.qualityNotes);
  assert.ok(quality.qualityNotes.some((note) => note.toLocaleLowerCase("pt-BR").includes("nitidez")));
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

test("class without an official positive reference cannot be accepted by conservative recognition policy", () => {
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
