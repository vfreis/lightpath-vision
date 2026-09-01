import assert from "node:assert/strict";
import test from "node:test";
import { finalizeModelDecision } from "../src/analyze.js";
import type { ModelDecision } from "../src/schemas.js";

const qualitySignals: ModelDecision["qualitySignals"] = {
  shape: { state: "positive", observation: "Formato aparente regular." },
  bake: { state: "neutral", observation: "Assamento visível sem conclusão operacional." },
  crust: { state: "positive", observation: "Cornicione visível." },
  toppingDistribution: { state: "neutral", observation: "Cobertura distribuída de forma aparente." },
  expectedIngredients: { state: "neutral", observation: "Alguns componentes esperados parecem presentes." }
};

function decision(overrides: Partial<ModelDecision> = {}): ModelDecision {
  return {
    status: "matched",
    predictedPizzaId: "zozzona",
    confidence: 0.91,
    alternatives: [{ pizzaId: "caprese", confidence: 0.55 }],
    evidence: ["Calabresa e cobertura compatíveis."],
    qualitySignals,
    warnings: [],
    ...overrides
  };
}

test("accepts an enabled catalog ID with sufficient separation", () => {
  const result = finalizeModelDecision("req-1", decision());
  assert.equal(result.status, "success");
  assert.equal(result.pizzaId, "zozzona");
  assert.equal(result.confidenceScore, null);
  assert.equal(result.confidenceCalibrated, false);
});

test("blocks IDs outside the enabled catalog", () => {
  const result = finalizeModelDecision("req-2", decision({ predictedPizzaId: "invented-pizza" }));
  assert.equal(result.status, "inconclusive");
  assert.equal(result.pizzaId, null);
});

test("returns inconclusive when the model heuristic is below threshold", () => {
  const result = finalizeModelDecision("req-3", decision({ confidence: 0.62 }));
  assert.equal(result.status, "inconclusive");
});

test("returns inconclusive when top candidates are too close", () => {
  const result = finalizeModelDecision("req-4", decision({
    confidence: 0.84,
    alternatives: [{ pizzaId: "caprese", confidence: 0.80 }]
  }));
  assert.equal(result.status, "inconclusive");
});
