import assert from "node:assert/strict";
import test from "node:test";
import { calibrateSelectivePolicy, evaluateSelectivePolicy, type CalibrationSample } from "../src/calibration.js";

const samples: CalibrationSample[] = [
  { caseId: "a", correct: true, heuristicScore: 0.95, margin: 0.30, referenceGrounded: true },
  { caseId: "b", correct: true, heuristicScore: 0.90, margin: 0.22, referenceGrounded: true },
  { caseId: "c", correct: true, heuristicScore: 0.86, margin: 0.18, referenceGrounded: true },
  { caseId: "d", correct: false, heuristicScore: 0.83, margin: 0.08, referenceGrounded: true },
  { caseId: "e", correct: false, heuristicScore: 0.79, margin: 0.05, referenceGrounded: true },
  { caseId: "f", correct: true, heuristicScore: 0.96, margin: 0.40, referenceGrounded: false }
];

test("selective metrics measure accepted accuracy and coverage, not probability calibration", () => {
  const metrics = evaluateSelectivePolicy(samples, { minHeuristicScore: 0.85, minMargin: 0.15 });
  assert.equal(metrics.accepted, 3);
  assert.equal(metrics.correctAccepted, 3);
  assert.equal(metrics.falsePositiveRate, 0);
  assert.equal(metrics.acceptedAccuracy, 1);
  assert.equal(metrics.coverage, 0.5);
});

test("calibration chooses a policy under the requested false-positive ceiling", () => {
  const result = calibrateSelectivePolicy(samples, { maxFalsePositiveRate: 0, minAccepted: 2 });
  assert.ok(result);
  assert.equal(result.metrics.falsePositiveRate, 0);
  assert.ok(result.metrics.accepted >= 2);
  assert.ok(result.metrics.coverage > 0);
});

test("non-grounded samples are never accepted by calibration helper", () => {
  const metrics = evaluateSelectivePolicy(
    [{ caseId: "x", correct: true, heuristicScore: 1, margin: 1, referenceGrounded: false }],
    { minHeuristicScore: 0, minMargin: 0 }
  );
  assert.equal(metrics.accepted, 0);
});
