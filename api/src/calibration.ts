export type CalibrationSample = {
  caseId: string;
  correct: boolean;
  heuristicScore: number;
  margin: number;
  referenceGrounded: boolean;
  confusionSetIds?: string[];
};

export type SelectivePolicyCandidate = {
  minHeuristicScore: number;
  minMargin: number;
};

export type SelectiveMetrics = {
  total: number;
  accepted: number;
  correctAccepted: number;
  falsePositiveAccepted: number;
  coverage: number;
  acceptedAccuracy: number | null;
  falsePositiveRate: number | null;
};

export function evaluateSelectivePolicy(
  samples: CalibrationSample[],
  policy: SelectivePolicyCandidate
): SelectiveMetrics {
  const acceptedSamples = samples.filter((sample) =>
    sample.referenceGrounded &&
    sample.heuristicScore >= policy.minHeuristicScore &&
    sample.margin >= policy.minMargin
  );
  const correctAccepted = acceptedSamples.filter((sample) => sample.correct).length;
  const falsePositiveAccepted = acceptedSamples.length - correctAccepted;

  return {
    total: samples.length,
    accepted: acceptedSamples.length,
    correctAccepted,
    falsePositiveAccepted,
    coverage: samples.length ? acceptedSamples.length / samples.length : 0,
    acceptedAccuracy: acceptedSamples.length ? correctAccepted / acceptedSamples.length : null,
    falsePositiveRate: acceptedSamples.length ? falsePositiveAccepted / acceptedSamples.length : null
  };
}

export function calibrateSelectivePolicy(
  samples: CalibrationSample[],
  options: { maxFalsePositiveRate?: number; minAccepted?: number } = {}
) {
  const maxFalsePositiveRate = options.maxFalsePositiveRate ?? 0.05;
  const minAccepted = options.minAccepted ?? Math.min(10, samples.length);
  if (!samples.length) return null;

  const scores = [...new Set(samples.map((sample) => sample.heuristicScore))].sort((a, b) => a - b);
  const margins = [...new Set(samples.map((sample) => sample.margin))].sort((a, b) => a - b);
  let best: { policy: SelectivePolicyCandidate; metrics: SelectiveMetrics } | null = null;

  for (const minHeuristicScore of scores) {
    for (const minMargin of margins) {
      const policy = { minHeuristicScore, minMargin };
      const metrics = evaluateSelectivePolicy(samples, policy);
      if (metrics.accepted < minAccepted) continue;
      if (metrics.falsePositiveRate === null || metrics.falsePositiveRate > maxFalsePositiveRate) continue;

      if (
        !best ||
        metrics.coverage > best.metrics.coverage ||
        (metrics.coverage === best.metrics.coverage && (metrics.acceptedAccuracy ?? 0) > (best.metrics.acceptedAccuracy ?? 0)) ||
        (metrics.coverage === best.metrics.coverage && metrics.acceptedAccuracy === best.metrics.acceptedAccuracy && minHeuristicScore > best.policy.minHeuristicScore)
      ) {
        best = { policy, metrics };
      }
    }
  }

  return best;
}

export function calibrateByConfusionSet(
  samples: CalibrationSample[],
  options: { maxFalsePositiveRate?: number; minGroupSize?: number; minAccepted?: number } = {}
) {
  const minGroupSize = options.minGroupSize ?? 10;
  const groups = new Map<string, CalibrationSample[]>();

  for (const sample of samples) {
    for (const id of sample.confusionSetIds ?? []) {
      const group = groups.get(id) ?? [];
      group.push(sample);
      groups.set(id, group);
    }
  }

  const results: Record<string, ReturnType<typeof calibrateSelectivePolicy>> = {};
  for (const [id, group] of groups) {
    if (group.length < minGroupSize) continue;
    results[id] = calibrateSelectivePolicy(group, {
      maxFalsePositiveRate: options.maxFalsePositiveRate,
      minAccepted: options.minAccepted
    });
  }
  return results;
}
