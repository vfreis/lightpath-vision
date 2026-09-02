import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const reportPath = process.argv[2]
const MIN_ACCEPTED_ACCURACY = Number(process.env.CAL_MIN_ACCEPTED_ACCURACY || 0.95)
const MAX_FALSE_POSITIVE_RATE = Number(process.env.CAL_MAX_FALSE_POSITIVE_RATE || 0.05)
const MAX_WRONG_ACCEPTED_RATE = Number(process.env.CAL_MAX_WRONG_ACCEPTED_RATE || 0.05)

function assert(value, message) {
  if (!value) throw new Error(message)
}

function round(value, digits = 4) {
  return value == null ? null : Number(value.toFixed(digits))
}

function rawPrediction(row) {
  const d = row.diagnostics
  if (!d) return null
  const alternatives = Array.isArray(d.rawAlternatives) ? d.rawAlternatives : []
  const nextBest = alternatives
    .filter(candidate => candidate.pizzaId !== d.rawPredictedPizzaId)
    .sort((a, b) => b.confidence - a.confidence)[0]
  const margin = typeof d.rawMargin === 'number'
    ? d.rawMargin
    : typeof d.rawConfidence === 'number'
      ? d.rawConfidence - (nextBest?.confidence ?? 0)
      : null
  return {
    status: d.modelStatus,
    pizzaId: d.rawPredictedPizzaId,
    confidence: d.rawConfidence,
    margin
  }
}

function score(rows, threshold, minMargin) {
  const positives = rows.filter(row => row.expectedId && row.expectedStatus === 'success')
  const negatives = rows.filter(row => !row.expectedId || row.expectedStatus === 'inconclusive')
  let accepted = 0
  let correctAccepted = 0
  let falsePositive = 0
  let wrongAcceptedPositive = 0
  let positiveAccepted = 0

  for (const row of rows) {
    const raw = rawPrediction(row)
    const accept = raw && raw.status === 'matched' && raw.pizzaId && raw.confidence >= threshold && raw.margin >= minMargin
    if (!accept) continue
    accepted += 1
    if (row.expectedId) positiveAccepted += 1
    if (row.expectedId && raw.pizzaId === row.expectedId) correctAccepted += 1
    else if (!row.expectedId || row.expectedStatus === 'inconclusive') falsePositive += 1
    else wrongAcceptedPositive += 1
  }

  return {
    threshold: round(threshold, 2),
    minMargin: round(minMargin, 2),
    accepted,
    acceptedAccuracy: accepted ? round(correctAccepted / accepted) : null,
    falsePositiveRate: negatives.length ? round(falsePositive / negatives.length) : null,
    wrongAcceptedRate: positives.length ? round(wrongAcceptedPositive / positives.length) : null,
    positiveCoverage: positives.length ? round(positiveAccepted / positives.length) : null,
    totalCoverage: rows.length ? round(accepted / rows.length) : null
  }
}

async function main() {
  assert(reportPath, 'Usage: node scripts/calibrate-evals.mjs <eval-report.json>')
  const report = JSON.parse(await readFile(resolve(reportPath), 'utf8'))
  assert(report.diagnosticsEnabled, 'The eval report has no raw diagnostics. Re-run with EVAL_DIAGNOSTICS_TOKEN.')
  assert(report.rows?.length, 'Eval report has no rows.')
  assert(report.rows.every(row => row.diagnostics), 'At least one row lacks diagnostics; calibration would be biased.')

  const grid = []
  for (let threshold = 0.50; threshold <= 0.96 + 1e-9; threshold += 0.01) {
    for (let margin = 0; margin <= 0.30 + 1e-9; margin += 0.01) {
      grid.push(score(report.rows, threshold, margin))
    }
  }

  const gated = grid
    .filter(point => point.accepted > 0)
    .filter(point => point.acceptedAccuracy >= MIN_ACCEPTED_ACCURACY)
    .filter(point => point.falsePositiveRate <= MAX_FALSE_POSITIVE_RATE)
    .filter(point => point.wrongAcceptedRate <= MAX_WRONG_ACCEPTED_RATE)
    .sort((a, b) =>
      (b.positiveCoverage - a.positiveCoverage) ||
      (b.acceptedAccuracy - a.acceptedAccuracy) ||
      (a.falsePositiveRate - b.falsePositiveRate) ||
      (a.threshold - b.threshold) ||
      (a.minMargin - b.minMargin)
    )

  const recommended = gated[0] || null
  const current = score(report.rows, 0.78, 0.10)
  const output = {
    schemaVersion: 1,
    testSetVersion: report.testSetVersion,
    sourceReport: resolve(reportPath),
    objective: {
      minAcceptedAccuracy: MIN_ACCEPTED_ACCURACY,
      maxFalsePositiveRate: MAX_FALSE_POSITIVE_RATE,
      maxWrongAcceptedRate: MAX_WRONG_ACCEPTED_RATE,
      optimization: 'maximize positive coverage after precision/false-positive gates'
    },
    caveat: 'rawConfidence is VLM self-reported evidence used only as a ranking/gating signal; this procedure does not turn it into a calibrated probability.',
    currentPolicy078_010: current,
    recommended,
    candidatesMeetingGate: gated.slice(0, 25),
    gridPointsEvaluated: grid.length
  }

  const outPath = resolve(reportPath.replace(/\.json$/i, '.calibration.json'))
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify(output, null, 2))
  console.log(`\nCalibration report: ${outPath}`)
  if (!recommended) process.exitCode = 3
}

main().catch(error => {
  console.error(`CALIBRATION FAILED: ${error.message}`)
  process.exitCode = 1
})
