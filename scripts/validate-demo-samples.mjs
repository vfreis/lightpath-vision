import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const BASE = (process.env.API_BASE_URL || '').replace(/\/$/, '')
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://vfreis.github.io'
const DEFAULT_SLUGS = 'zozzona,bastarda,caprese,nutella-lindt-brownie,provola-croccante-di-parma,cuore-di-napoli'
const SLUGS = (process.env.DEMO_SLUGS || DEFAULT_SLUGS).split(',').map(x => x.trim()).filter(Boolean)
const OUTPUT = process.env.DEMO_OUTPUT || 'frontend/src/demo-samples.json'
const WRITE = process.env.WRITE_DEMO === '1'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readJson(response) {
  const text = await response.text()
  try { return JSON.parse(text) } catch { throw new Error(`Non-JSON response ${response.status}: ${text.slice(0, 240)}`) }
}

async function analyze(bytes, type, filename) {
  const form = new FormData()
  form.append('image', new Blob([bytes], { type }), filename)
  const response = await fetch(`${BASE}/api/v1/analyze`, {
    method: 'POST',
    headers: { Origin: CORS_ORIGIN },
    body: form
  })
  const data = await readJson(response)
  assert(response.ok, `Analyze ${filename} failed: HTTP ${response.status} ${JSON.stringify(data)}`)
  return data
}

async function main() {
  assert(BASE.startsWith('https://'), 'API_BASE_URL must be the HTTPS Hostinger API origin')

  const healthResponse = await fetch(`${BASE}/healthz`, { headers: { Origin: CORS_ORIGIN }, cache: 'no-store' })
  const health = await readJson(healthResponse)
  assert(healthResponse.ok && health.status === 'ok', 'Hostinger /healthz is not ready')
  assert(health.recognitionClasses === 36, `Safe demo requires 36 enabled classes; got ${health.recognitionClasses}`)
  assert(health.openaiConfigured === true, 'Safe demo cannot be validated without the real OpenAI integration')

  const catalogResponse = await fetch(`${BASE}/api/v1/catalog`, { headers: { Origin: CORS_ORIGIN }, cache: 'no-store' })
  const catalog = await readJson(catalogResponse)
  assert(catalogResponse.ok && Array.isArray(catalog.items), 'Catalog unavailable')
  const bySlug = new Map(catalog.items.map(item => [item.pizzaId, item]))

  const validatedAt = new Date().toISOString()
  const samples = []

  for (const slug of SLUGS) {
    const item = bySlug.get(slug)
    assert(item, `Unknown catalog slug: ${slug}`)
    assert(item.referenceImage, `No verified official reference image for ${slug}`)

    const imageResponse = await fetch(item.referenceImage, { redirect: 'follow', cache: 'no-store' })
    assert(imageResponse.ok, `Could not fetch official reference for ${slug}: HTTP ${imageResponse.status}`)
    const bytes = Buffer.from(await imageResponse.arrayBuffer())
    const type = imageResponse.headers.get('content-type') || 'image/webp'
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const result = await analyze(bytes, type, `${slug}.reference`)

    assert(result.status === 'success' && result.pizzaId === slug,
      `${slug} is NOT safe-demo ready: expected success:${slug}, got ${result.status}:${result.pizzaId}`)

    samples.push({
      id: slug,
      name: item.pizzaName,
      image: item.referenceImage,
      sha256,
      validatedAt,
      validatedAgainst: BASE,
      validatedResult: result,
      provenance: `Imagem oficial La Braciera exposta pelo catálogo ${catalog.catalogVersion}; ${item.referenceImage}`
    })
    console.log(`VALIDATED ${slug} sha256=${sha256.slice(0, 12)}… requestId=${result.requestId}`)
  }

  const output = `${JSON.stringify(samples, null, 2)}\n`
  if (WRITE) {
    writeFileSync(OUTPUT, output, 'utf8')
    console.log(`\nWROTE ${samples.length} real safe-demo samples to ${OUTPUT}`)
  } else {
    console.log('\nDry run only. Set WRITE_DEMO=1 after reviewing the real results.\n')
    process.stdout.write(output)
  }
}

main().catch(error => {
  console.error('\nSAFE DEMO VALIDATION FAILED:', error.message)
  process.exitCode = 1
})
