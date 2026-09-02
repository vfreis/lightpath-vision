import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { CASES, SOURCES, TEST_SET_VERSION } from '../evals/v0.1/manifest.mjs'

const SOURCE_DIR = resolve(process.env.EVAL_SOURCE_DIR || 'evals/v0.1/sources')
const OUTPUT_DIR = resolve(process.env.EVAL_OUTPUT_DIR || 'evals/results')

function assert(value, message) {
  if (!value) throw new Error(message)
}

async function loadVerifiedSource(sourceRef) {
  const source = SOURCES[sourceRef]
  assert(source, `Unknown sourceRef ${sourceRef}`)
  const path = resolve(SOURCE_DIR, source.file)
  const bytes = await readFile(path).catch(() => null)
  assert(bytes, `Missing eval source ${path}.`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert(sha256 === source.sha256, `SHA-256 mismatch for ${source.file}`)
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

async function main() {
  assert(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required in the private calibration environment.')
  await mkdir(OUTPUT_DIR, { recursive: true })

  // Import compiled production modules only after checking the environment.
  const [{ normalizeImage }, { classifyWithOpenAI }, { finalizeModelDecision }, { config }] = await Promise.all([
    import('../api/dist/src/image.js'),
    import('../api/dist/src/openai.js'),
    import('../api/dist/src/analyze.js'),
    import('../api/dist/src/config.js')
  ])

  const rows = []
  for (let index = 0; index < CASES.length; index += 1) {
    const testCase = CASES[index]
    process.stdout.write(`[${index + 1}/${CASES.length}] ${testCase.id} ... `)
    const rendered = await renderCase(testCase)
    const normalized = await normalizeImage(rendered)
    const started = performance.now()
    try {
      const raw = await classifyWithOpenAI(normalized)
      const latencyMs = performance.now() - started
      const result = finalizeModelDecision(`internal-eval-${index + 1}`, raw)
      const nextBest = [...raw.alternatives]
        .filter(candidate => candidate.pizzaId !== raw.predictedPizzaId)
        .sort((a, b) => b.confidence - a.confidence)[0]
      const rawMargin = nextBest ? raw.confidence - nextBest.confidence : 1
      rows.push({
        testCaseId: testCase.id,
        expectedId: testCase.expectedId,
        groundTruthFamily: testCase.groundTruthFamily,
        expectedStatus: testCase.expectedStatus,
        confusionGroup: testCase.confusionGroup,
        sourceType: testCase.sourceType,
        latencyMs: Number(latencyMs.toFixed(1)),
        result,
        diagnostics: {
          modelStatus: raw.status,
          rawPredictedPizzaId: raw.predictedPizzaId,
          rawConfidence: raw.confidence,
          rawMargin,
          rawAlternatives: raw.alternatives,
          evidence: raw.evidence,
          warnings: raw.warnings
        }
      })
      console.log(`${result.status}:${result.pizzaId || 'none'} raw=${raw.confidence.toFixed(3)} margin=${rawMargin.toFixed(3)} ${latencyMs.toFixed(0)}ms`)
    } catch (error) {
      rows.push({
        testCaseId: testCase.id,
        expectedId: testCase.expectedId,
        groundTruthFamily: testCase.groundTruthFamily,
        expectedStatus: testCase.expectedStatus,
        confusionGroup: testCase.confusionGroup,
        sourceType: testCase.sourceType,
        latencyMs: Number((performance.now() - started).toFixed(1)),
        result: null,
        diagnostics: null,
        error: { name: error?.name || 'Error', message: String(error?.message || error) }
      })
      console.log(`ERROR ${error?.message || error}`)
    }
  }

  const report = {
    schemaVersion: 1,
    testSetVersion: TEST_SET_VERSION,
    diagnosticsEnabled: true,
    mode: 'private_internal_calibration',
    model: config.OPENAI_MODEL,
    thresholdAtCollection: config.MATCH_THRESHOLD,
    minMarginAtCollection: config.MIN_TOP_MARGIN,
    createdAt: new Date().toISOString(),
    caveat: 'rawConfidence is an uncalibrated VLM signal. It is collected only to empirically choose abstention thresholds; never present it as a probability.',
    rows
  }
  const stamp = report.createdAt.replace(/[:.]/g, '-').replace('Z', '')
  const output = resolve(OUTPUT_DIR, `${TEST_SET_VERSION}-${stamp}.calibration-raw.json`)
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`\nRaw calibration report: ${output}`)
  if (rows.some(row => !row.diagnostics)) process.exitCode = 2
}

main().catch(error => {
  console.error(`CALIBRATION COLLECTION FAILED: ${error.message}`)
  process.exitCode = 1
})
