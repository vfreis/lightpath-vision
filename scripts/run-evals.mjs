import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { CASES, METRIC_POLICY, PENDING_COVERAGE, SOURCES, TEST_SET_VERSION } from '../evals/v0.1/manifest.mjs'

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/$/, '')
const SOURCE_DIR = resolve(process.env.EVAL_SOURCE_DIR || 'evals/v0.1/sources')
const OUTPUT_DIR = resolve(process.env.EVAL_OUTPUT_DIR || 'evals/results')
const EVAL_TOKEN = process.env.EVAL_DIAGNOSTICS_TOKEN || ''
const REQUEST_TIMEOUT_MS = Number(process.env.EVAL_REQUEST_TIMEOUT_MS || 90000)

function assert(value, message) {
  if (!value) throw new Error(message)
}

function quantile(values, q) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function round(value, digits = 4) {
  return value == null ? null : Number(value.toFixed(digits))
}

async function loadVerifiedSource(sourceRef) {
  const source = SOURCES[sourceRef]
  assert(source, `Unknown sourceRef ${sourceRef}`)
  const path = resolve(SOURCE_DIR, source.file)
  const bytes = await readFile(path).catch(() => null)
  assert(bytes, `Missing eval source ${path}. Copy the controlled Drive asset locally before running.`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert(sha256 === source.sha256, `SHA-256 mismatch for ${source.file}. Expected ${source.sha256}, got ${sha256}`)
  return bytes
}

async function renderCase(testCase) {
  const sourceBytes = await loadVerifiedSource(testCase.sourceRef)
  let pipeline = sharp(sourceBytes, { failOn: 'warning' })
  if (testCase.crop) {
    const [left, top, width, height] = testCase.crop
    pipeline = pipeline.extract({ left, top, width, height })
  }
  const transform = testCase.transform || {}
  if (transform.relativeExtract) {
    const [rx, ry, rw, rh] = transform.relativeExtract
    const meta = await pipeline.clone().metadata()
    const width = meta.width || 1
    const height = meta.height || 1
    pipeline = pipeline.extract({
      left: Math.max(0, Math.floor(width * rx)),
      top: Math.max(0, Math.floor(height * ry)),
      width: Math.max(1, Math.floor(width * rw)),
      height: Math.max(1, Math.floor(height * rh))
    })
  }
  if (transform.blurSigma) pipeline = pipeline.blur(transform.blurSigma)
  if (transform.brightness) pipeline = pipeline.modulate({ brightness: transform.brightness })
  if (transform.resize) pipeline = pipeline.resize(transform.resize[0], transform.resize[1], { fit: 'fill' })
  if (transform.fit) pipeline = pipeline.resize(transform.fit[0], transform.fit[1], { fit: 'inside' })
  return pipeline.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}

async function analyze(testCase) {
  const image = await renderCase(testCase)
  const form = new FormData()
  form.append('image', new Blob([image], { type: 'image/jpeg' }), `${testCase.id}.jpg`)
  const diagnostics = Boolean(EVAL_TOKEN)
  const endpoint = diagnostics ? '/api/v1/eval/analyze' : '/api/v1/analyze'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers = diagnostics ? { 'X-Eval-Token': EVAL_TOKEN } : {}
  const started = performance.now()
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers, body: form, signal: controller.signal })
    const latencyMs = performance.now() - started
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      return { testCase, latencyMs, httpStatus: response.status, result: null, diagnostics: null, error: body || { code: `HTTP_${response.status}` } }
    }
    if (diagnostics) return { testCase, latencyMs, httpStatus: response.status, result: body.result, diagnostics: body.diagnostics, error: null }
    return { testCase, latencyMs, httpStatus: response.status, result: body, diagnostics: null, error: null }
  } catch (error) {
    return { testCase, latencyMs: performance.now() - started, httpStatus: 0, result: null, diagnostics: null, error: { code: error?.name === 'AbortError' ? 'timeout' : 'network_error', message: String(error?.message || error) } }
  } finally {
    clearTimeout(timer)
  }
}

function computeMetrics(rows) {
  const positives = rows.filter(row => row.testCase.expectedId && row.testCase.expectedStatus === 'success')
  const negatives = rows.filter(row => !row.testCase.expectedId || row.testCase.expectedStatus === 'inconclusive')
  const nonErrors = rows.filter(row => row.result && (row.result.status === 'success' || row.result.status === 'inconclusive'))
  const accepted = nonErrors.filter(row => row.result.status === 'success')
  const inconclusive = nonErrors.filter(row => row.result.status === 'inconclusive')

  const topIds = row => {
    if (!row.result) return []
    const ids = [row.result.pizzaId, ...(row.result.alternatives || []).map(item => item.pizzaId)].filter(Boolean)
    return [...new Set(ids)].slice(0, 3)
  }

  const top1Correct = positives.filter(row => row.result?.status === 'success' && row.result.pizzaId === row.testCase.expectedId).length
  const top3Correct = positives.filter(row => topIds(row).includes(row.testCase.expectedId)).length
  const acceptedCorrect = accepted.filter(row => row.testCase.expectedId && row.result.pizzaId === row.testCase.expectedId).length
  const negativeFalsePositives = negatives.filter(row => row.result?.status === 'success').length
  const wrongAcceptedPositives = positives.filter(row => row.result?.status === 'success' && row.result.pizzaId !== row.testCase.expectedId).length

  const perClass = {}
  for (const row of positives) {
    const id = row.testCase.expectedId
    perClass[id] ||= { total: 0, top1Correct: 0, top3Correct: 0 }
    perClass[id].total += 1
    if (row.result?.status === 'success' && row.result.pizzaId === id) perClass[id].top1Correct += 1
    if (topIds(row).includes(id)) perClass[id].top3Correct += 1
  }
  for (const stats of Object.values(perClass)) {
    stats.recall = round(stats.top1Correct / stats.total)
    stats.top3Recall = round(stats.top3Correct / stats.total)
  }

  const matrix = {}
  for (const row of rows) {
    const expected = row.testCase.expectedId || `__${row.testCase.groundTruthFamily.toUpperCase()}_NEGATIVE__`
    const predicted = row.result?.status === 'success' ? row.result.pizzaId : row.result?.status === 'inconclusive' ? '__INCONCLUSIVE__' : '__ERROR__'
    matrix[expected] ||= {}
    matrix[expected][predicted] = (matrix[expected][predicted] || 0) + 1
  }

  const latencies = rows.map(row => row.latencyMs).filter(Number.isFinite)
  const errorCount = rows.length - nonErrors.length
  const familyRows = rows.filter(row => row.result?.family)
  const familyCorrect = familyRows.filter(row => row.result.family === row.testCase.groundTruthFamily).length

  return {
    counts: { total: rows.length, positives: positives.length, negatives: negatives.length, accepted: accepted.length, inconclusive: inconclusive.length, errors: errorCount },
    top1Accuracy: positives.length ? round(top1Correct / positives.length) : null,
    top3Recall: positives.length ? round(top3Correct / positives.length) : null,
    acceptedAccuracy: accepted.length ? round(acceptedCorrect / accepted.length) : null,
    falsePositiveRate: negatives.length ? round(negativeFalsePositives / negatives.length) : null,
    wrongAcceptedRate: positives.length ? round(wrongAcceptedPositives / positives.length) : null,
    inconclusiveRate: nonErrors.length ? round(inconclusive.length / nonErrors.length) : null,
    coverage: nonErrors.length ? round(accepted.length / nonErrors.length) : null,
    perClassRecall: perClass,
    confusionMatrix: matrix,
    latencyMs: {
      mean: latencies.length ? round(latencies.reduce((a, b) => a + b, 0) / latencies.length, 1) : null,
      p50: round(quantile(latencies, 0.5), 1),
      p95: round(quantile(latencies, 0.95), 1),
      min: latencies.length ? round(Math.min(...latencies), 1) : null,
      max: latencies.length ? round(Math.max(...latencies), 1) : null
    },
    familyRouter: familyRows.length ? { available: true, accuracy: round(familyCorrect / familyRows.length), measured: familyRows.length } : { available: false, reason: 'Current public baseline response has no family field; Recognition V2 must add it before the family gate can be scored.' }
  }
}

function hardNegativeCandidates(rows) {
  return rows.filter(row => row.result?.status === 'success' && row.result.pizzaId !== row.testCase.expectedId).map(row => ({
    testCaseId: row.testCase.id,
    groundTruthFamily: row.testCase.groundTruthFamily,
    expectedId: row.testCase.expectedId,
    predictedId: row.result.pizzaId,
    requestId: row.result.requestId,
    confusionGroup: row.testCase.confusionGroup,
    sourceRef: row.testCase.sourceRef,
    reason: row.testCase.expectedId ? 'accepted_wrong_class' : 'accepted_negative_or_ood'
  }))
}

function markdown(report) {
  const m = report.metrics
  const pct = value => value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`
  const lines = [
    `# Braciera Vision Eval — ${report.testSetVersion}`,
    '',
    `- API: ${report.apiBaseUrl}`,
    `- Model reported by /healthz: ${report.health?.model || 'unknown'}`,
    `- Catalog version: ${report.health?.catalogVersion || 'unknown'}`,
    `- Timestamp: ${report.finishedAt}`,
    `- Diagnostics/calibration data: ${report.diagnosticsEnabled ? 'enabled' : 'disabled'}`,
    '',
    '## Metrics',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Top-1 accuracy | ${pct(m.top1Accuracy)} |`,
    `| Top-3 recall | ${pct(m.top3Recall)} |`,
    `| Accepted accuracy | ${pct(m.acceptedAccuracy)} |`,
    `| False-positive rate (negative set) | ${pct(m.falsePositiveRate)} |`,
    `| Wrong accepted rate (positive set) | ${pct(m.wrongAcceptedRate)} |`,
    `| Inconclusive rate | ${pct(m.inconclusiveRate)} |`,
    `| Coverage | ${pct(m.coverage)} |`,
    `| Latency p50 | ${m.latencyMs.p50 ?? 'n/a'} ms |`,
    `| Latency p95 | ${m.latencyMs.p95 ?? 'n/a'} ms |`,
    '',
    `Errors: ${m.counts.errors}. Hard-negative candidates: ${report.hardNegativeCandidates.length}.`,
    '',
    '## Coverage blockers',
    '',
    ...report.pendingCoverage.map(item => `- ${item.family || item.expectedId || item.kind}: ${item.reason}`),
    '',
    '## Metric definitions',
    '',
    ...Object.entries(METRIC_POLICY).map(([key, value]) => `- **${key}** — ${value}`)
  ]
  return `${lines.join('\n')}\n`
}

async function main() {
  assert(API_BASE_URL.startsWith('https://') || API_BASE_URL.startsWith('http://localhost'), 'Set API_BASE_URL to the Hostinger HTTPS origin or localhost.')
  await mkdir(OUTPUT_DIR, { recursive: true })

  const healthStart = performance.now()
  const healthResponse = await fetch(`${API_BASE_URL}/healthz`, { cache: 'no-store' })
  const healthLatencyMs = performance.now() - healthStart
  const health = await healthResponse.json().catch(() => null)
  assert(healthResponse.ok && health?.status === 'ok', `Hostinger health check failed: HTTP ${healthResponse.status}`)
  assert(health.openaiConfigured === true, 'OpenAI is not configured on the target API.')

  const rows = []
  for (let index = 0; index < CASES.length; index += 1) {
    const testCase = CASES[index]
    process.stdout.write(`[${index + 1}/${CASES.length}] ${testCase.id} ... `)
    const row = await analyze(testCase)
    rows.push(row)
    const rendered = row.result ? `${row.result.status}:${row.result.pizzaId || 'none'}` : `ERROR:${row.error?.code || row.httpStatus}`
    console.log(`${rendered} ${row.latencyMs.toFixed(0)}ms`)
  }

  const metrics = computeMetrics(rows)
  const hardNegatives = hardNegativeCandidates(rows)
  const finishedAt = new Date().toISOString()
  const stamp = finishedAt.replace(/[:.]/g, '-').replace('Z', '')
  const report = {
    schemaVersion: 1,
    testSetVersion: TEST_SET_VERSION,
    apiBaseUrl: API_BASE_URL,
    startedFromHealthLatencyMs: round(healthLatencyMs, 1),
    finishedAt,
    health,
    diagnosticsEnabled: Boolean(EVAL_TOKEN),
    metricPolicy: METRIC_POLICY,
    metrics,
    pendingCoverage: PENDING_COVERAGE,
    hardNegativeCandidates: hardNegatives,
    rows: rows.map(row => ({
      testCaseId: row.testCase.id,
      expectedId: row.testCase.expectedId,
      groundTruthFamily: row.testCase.groundTruthFamily,
      expectedStatus: row.testCase.expectedStatus,
      confusionGroup: row.testCase.confusionGroup,
      sourceType: row.testCase.sourceType,
      latencyMs: round(row.latencyMs, 1),
      httpStatus: row.httpStatus,
      result: row.result,
      diagnostics: row.diagnostics,
      error: row.error
    }))
  }

  const jsonPath = resolve(OUTPUT_DIR, `${TEST_SET_VERSION}-${stamp}.json`)
  const mdPath = resolve(OUTPUT_DIR, `${TEST_SET_VERSION}-${stamp}.md`)
  const hardPath = resolve(OUTPUT_DIR, `${TEST_SET_VERSION}-${stamp}.hard-negatives.json`)
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(mdPath, markdown(report))
  await writeFile(hardPath, `${JSON.stringify(hardNegatives, null, 2)}\n`)

  console.log('\nMetrics:', JSON.stringify(metrics, null, 2))
  console.log(`\nReports: ${jsonPath}\n         ${mdPath}`)
  if (hardNegatives.length) console.log(`Hard-negative candidates: ${hardPath}`)

  if (metrics.counts.errors) process.exitCode = 2
}

main().catch(error => {
  console.error(`EVAL FAILED: ${error.message}`)
  process.exitCode = 1
})
