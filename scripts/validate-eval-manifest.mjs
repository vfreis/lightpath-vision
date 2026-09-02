import { readFile } from 'node:fs/promises'
import { CASES, PENDING_COVERAGE, SOURCES, TEST_SET_VERSION } from '../evals/v0.1/manifest.mjs'

function assert(value, message) {
  if (!value) throw new Error(message)
}

const menu = JSON.parse(await readFile('data/menu.json', 'utf8'))
const catalogIds = new Set(menu.map(item => item.slug))
const caseIds = new Set()
let positives = 0
let negatives = 0

for (const testCase of CASES) {
  assert(!caseIds.has(testCase.id), `Duplicate eval case ID: ${testCase.id}`)
  caseIds.add(testCase.id)
  const source = SOURCES[testCase.sourceRef]
  assert(source, `Unknown sourceRef ${testCase.sourceRef} in ${testCase.id}`)
  assert(/^[a-f0-9]{64}$/.test(source.sha256), `Invalid source SHA-256 for ${testCase.sourceRef}`)

  if (testCase.crop) {
    const [left, top, width, height] = testCase.crop
    assert([left, top, width, height].every(Number.isInteger), `Non-integer crop in ${testCase.id}`)
    assert(left >= 0 && top >= 0 && width > 0 && height > 0, `Invalid crop in ${testCase.id}`)
    assert(left + width <= source.width && top + height <= source.height, `Crop exceeds source bounds in ${testCase.id}`)
  }

  if (testCase.expectedId) {
    positives += 1
    assert(catalogIds.has(testCase.expectedId), `Positive eval ground truth not found in baseline catalog: ${testCase.expectedId}`)
    assert(testCase.expectedStatus === 'success', `Positive case ${testCase.id} must expect success`)
  } else {
    negatives += 1
    assert(testCase.expectedStatus === 'inconclusive', `Negative case ${testCase.id} must expect inconclusive`)
  }
}

assert(CASES.length === 38, `Expected 38 v0.1 measured cases, got ${CASES.length}`)
assert(positives === 32, `Expected 32 positive v0.1 cases, got ${positives}`)
assert(negatives === 6, `Expected 6 negative v0.1 cases, got ${negatives}`)
assert(PENDING_COVERAGE.some(item => item.family === 'calzone'), 'Calzone coverage gap must stay explicit until a supervised image exists')

console.log(JSON.stringify({
  ok: true,
  testSetVersion: TEST_SET_VERSION,
  measuredCases: CASES.length,
  positiveCases: positives,
  negativeCases: negatives,
  uniqueGroundTruthClasses: new Set(CASES.map(testCase => testCase.expectedId).filter(Boolean)).size,
  pendingCoverage: PENDING_COVERAGE.length
}, null, 2))
