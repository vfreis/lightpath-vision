import { schema, validateModelOutput } from './contract.js'
import { buildPrompt, PROMPT_VERSION } from './prompt.js'

export function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return null
}

function isRemoteImage(value) {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch { return false }
}

export function buildVisionContent({ imageBase64, mimeType, catalog, maxReferenceImages = 8 }) {
  const content = [
    { type:'input_text', text: buildPrompt(catalog) },
    { type:'input_text', text:'IMAGEM A CLASSIFICAR:' },
    { type:'input_image', image_url:`data:${mimeType};base64,${imageBase64}`, detail:'high' }
  ]

  let used = 0
  for (const item of catalog.filter(x => x.recognitionEnabled)) {
    if (used >= maxReferenceImages) break
    const candidates = [
      ...(Array.isArray(item.referenceImages) ? item.referenceImages : []),
      item.referenceImage
    ]
    const reference = candidates.find(isRemoteImage)
    if (!reference) continue
    content.push({ type:'input_text', text:`REFERÊNCIA VISUAL — slug=${item.slug}; nome=${item.displayName}. Compare visualmente sem tratá-la como padrão oficial de QA.` })
    content.push({ type:'input_image', image_url:reference, detail:'low' })
    used += 1
  }

  if (used === 0) {
    content.push({ type:'input_text', text:'Nenhuma referência visual remota está disponível no catálogo atual. Seja mais conservador e use inconclusive quando os elementos visíveis não diferenciarem claramente uma classe.' })
  }
  return content
}

export async function classifyWithOpenAI({ imageBase64, mimeType, catalog, apiKey, model, signal, maxReferenceImages = 8 }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      input: [{ role:'user', content:buildVisionContent({ imageBase64, mimeType, catalog, maxReferenceImages }) }],
      text: { format: { type:'json_schema', name:'braciera_pizza_analysis', strict:true, schema } },
      metadata: { prompt_version: PROMPT_VERSION }
    })
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const error = new Error(`OpenAI ${response.status}`)
    error.status = response.status
    error.detail = body.slice(0, 500)
    throw error
  }
  const data = await response.json()
  const text = extractOutputText(data)
  if (!text) throw new Error('OPENAI_EMPTY_OUTPUT')
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('OPENAI_INVALID_JSON') }
  return { parsed: validateModelOutput(parsed), responseId: data.id || null }
}
