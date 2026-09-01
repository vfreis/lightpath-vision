const BASE = (process.env.API_BASE_URL || '').replace(/\/$/, '')
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://vfreis.github.io'
const DISTINCTIVE = (process.env.DISTINCTIVE_SLUGS || 'zozzona,nutella-lindt-brownie').split(',').map(x => x.trim()).filter(Boolean)
const SIMILAR = (process.env.SIMILAR_SLUGS || 'caprese,cuore-di-napoli').split(',').map(x => x.trim()).filter(Boolean)
const OOD_PIZZA_URL = process.env.OOD_PIZZA_URL || 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Hawaiian%20pizza%202023.jpg?width=960'

const POOR_PHOTO_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABcQERQRDhcUEhQaGBcbIjklIh8fIkYyNSk5UkhXVVFIUE5bZoNvW2F8Yk5QcptzfIeLkpSSWG2grJ+OqoOPko3/2wBDARgaGiIeIkMlJUONXlBejY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY3/wAARCAFAAUADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9k='

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readJson(response) {
  const text = await response.text()
  try { return JSON.parse(text) } catch { throw new Error(`Non-JSON response ${response.status}: ${text.slice(0, 240)}`) }
}

async function fetchImage(url) {
  const response = await fetch(url, { redirect: 'follow' })
  assert(response.ok, `Could not fetch QA image: ${response.status} ${url}`)
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    type: response.headers.get('content-type') || 'image/jpeg'
  }
}

async function postImage(bytes, type, filename) {
  const form = new FormData()
  form.append('image', new Blob([bytes], { type }), filename)
  const response = await fetch(`${BASE}/api/v1/analyze`, {
    method: 'POST',
    headers: { Origin: CORS_ORIGIN },
    body: form
  })
  const data = await readJson(response)
  assert(response.headers.get('access-control-allow-origin') === CORS_ORIGIN, 'Analyze response is missing expected CORS allow-origin')
  return { response, data }
}

async function main() {
  assert(BASE.startsWith('https://'), 'API_BASE_URL must be the HTTPS Hostinger API origin')

  const healthResponse = await fetch(`${BASE}/healthz`, { headers: { Origin: CORS_ORIGIN }, cache: 'no-store' })
  const health = await readJson(healthResponse)
  assert(healthResponse.ok, `/healthz failed: ${healthResponse.status}`)
  assert(health.status === 'ok', '/healthz status is not ok')
  assert(health.recognitionClasses === 36, `/healthz expected 36 classes, got ${health.recognitionClasses}`)
  assert(health.openaiConfigured === true, '/healthz reports OpenAI is not configured')
  assert(healthResponse.headers.get('access-control-allow-origin') === CORS_ORIGIN, '/healthz CORS is not allowing the frontend origin')
  console.log('PASS healthz', health)

  const catalogResponse = await fetch(`${BASE}/api/v1/catalog`, { headers: { Origin: CORS_ORIGIN }, cache: 'no-store' })
  const catalog = await readJson(catalogResponse)
  assert(catalogResponse.ok && catalog.status === 'success', 'Catalog endpoint failed')
  assert(Array.isArray(catalog.items) && catalog.items.length === 36, `Catalog expected 36 items, got ${catalog.items?.length}`)
  const referenced = catalog.items.filter(item => item.referenceImage)
  assert(referenced.length >= 6, `Expected at least 6 official reference images, got ${referenced.length}`)
  console.log(`PASS catalog: 36 classes; ${referenced.length} official references exposed`)

  const preflight = await fetch(`${BASE}/api/v1/analyze`, {
    method: 'OPTIONS',
    headers: {
      Origin: CORS_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  })
  assert(preflight.ok || preflight.status === 204, `CORS preflight failed: ${preflight.status}`)
  assert(preflight.headers.get('access-control-allow-origin') === CORS_ORIGIN, 'CORS preflight did not echo approved origin')
  console.log('PASS CORS preflight')

  const missingImageResponse = await fetch(`${BASE}/api/v1/analyze`, { method: 'POST', headers: { Origin: CORS_ORIGIN } })
  const missingImage = await readJson(missingImageResponse)
  assert(missingImageResponse.status === 400 && missingImage.code === 'image_required', 'Missing-image error contract failed')
  console.log('PASS explicit API error: image_required')

  const poor = await postImage(Buffer.from(POOR_PHOTO_BASE64, 'base64'), 'image/jpeg', 'poor-photo.jpg')
  assert(poor.response.ok, `Poor-photo analysis returned HTTP ${poor.response.status}`)
  assert(poor.data.status === 'inconclusive', `Poor photo must be inconclusive, got ${poor.data.status}:${poor.data.pizzaId}`)
  console.log('PASS poor photo -> inconclusive')

  const outOfCatalogImage = await fetchImage(OOD_PIZZA_URL)
  const outOfCatalog = await postImage(outOfCatalogImage.bytes, outOfCatalogImage.type, 'hawaiian-out-of-catalog.jpg')
  assert(outOfCatalog.response.ok, `Out-of-catalog analysis returned HTTP ${outOfCatalog.response.status}`)
  assert(outOfCatalog.data.status === 'inconclusive', `Out-of-catalog pizza must be inconclusive, got ${outOfCatalog.data.status}:${outOfCatalog.data.pizzaId}`)
  console.log('PASS out-of-catalog Hawaiian pizza -> inconclusive')

  const bySlug = new Map(catalog.items.map(item => [item.pizzaId, item]))
  for (const slug of DISTINCTIVE) {
    const item = bySlug.get(slug)
    assert(item?.referenceImage, `Distinctive QA slug ${slug} has no official referenceImage`)
    const image = await fetchImage(item.referenceImage)
    const analyzed = await postImage(image.bytes, image.type, `${slug}.jpg`)
    assert(analyzed.response.ok, `${slug} returned HTTP ${analyzed.response.status}`)
    assert(analyzed.data.status === 'success' && analyzed.data.pizzaId === slug, `${slug} expected success:${slug}, got ${analyzed.data.status}:${analyzed.data.pizzaId}`)
    console.log(`PASS official reference ${slug} -> success:${slug}`)
  }

  for (const slug of SIMILAR) {
    const item = bySlug.get(slug)
    assert(item?.referenceImage, `Similar-class QA slug ${slug} has no official referenceImage`)
    const image = await fetchImage(item.referenceImage)
    const analyzed = await postImage(image.bytes, image.type, `${slug}.jpg`)
    assert(analyzed.response.ok, `${slug} returned HTTP ${analyzed.response.status}`)
    const safe = analyzed.data.status === 'inconclusive' || (analyzed.data.status === 'success' && analyzed.data.pizzaId === slug)
    assert(safe, `${slug} was unsafely misclassified as ${analyzed.data.pizzaId}`)
    console.log(`PASS similar-class guard ${slug} -> ${analyzed.data.status}:${analyzed.data.pizzaId ?? 'none'}`)
  }

  console.log('\nA4 API smoke PASS. This is not a mobile/browser GO by itself.')
}

main().catch(error => {
  console.error('\nA4 API smoke FAIL:', error.message)
  process.exitCode = 1
})
