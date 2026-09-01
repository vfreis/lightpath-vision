import { schema } from './contract.js'
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

export async function classifyWithOpenAI({ imageBase64, mimeType, catalog, apiKey, model, signal }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [{ role:'user', content:[
        { type:'input_text', text: buildPrompt(catalog) },
        { type:'input_image', image_url:`data:${mimeType};base64,${imageBase64}` }
      ]}],
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
  return { parsed: JSON.parse(text), responseId: data.id || null }
}
