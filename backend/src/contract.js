export const schema = {
  type: 'object', additionalProperties: false,
  required: ['status','predictedFlavor','confidence','topCandidates','visualSignals','warnings'],
  properties: {
    status: { type: 'string', enum: ['success','inconclusive'] },
    predictedFlavor: { anyOf: [{type:'string'}, {type:'null'}] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    topCandidates: { type: 'array', maxItems: 3, items: { type:'object', additionalProperties:false, required:['slug','confidence'], properties:{ slug:{type:'string'}, confidence:{type:'number',minimum:0,maximum:1} } } },
    visualSignals: { type:'array', maxItems:5, items:{ type:'object', additionalProperties:false, required:['label','state','detail'], properties:{label:{type:'string'},state:{type:'string',enum:['positive','attention','unknown']},detail:{type:'string'}}}},
    warnings: { type:'array', maxItems:5, items:{type:'string'} }
  }
}

function assertConfidence(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`OPENAI_INVALID_OUTPUT:${field}`)
}

export function validateModelOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('OPENAI_INVALID_OUTPUT:root')
  if (!['success','inconclusive'].includes(value.status)) throw new Error('OPENAI_INVALID_OUTPUT:status')
  if (value.predictedFlavor !== null && typeof value.predictedFlavor !== 'string') throw new Error('OPENAI_INVALID_OUTPUT:predictedFlavor')
  assertConfidence(value.confidence, 'confidence')

  if (!Array.isArray(value.topCandidates) || value.topCandidates.length > 3) throw new Error('OPENAI_INVALID_OUTPUT:topCandidates')
  for (const candidate of value.topCandidates) {
    if (!candidate || typeof candidate.slug !== 'string') throw new Error('OPENAI_INVALID_OUTPUT:candidate.slug')
    assertConfidence(candidate.confidence, 'candidate.confidence')
  }

  if (!Array.isArray(value.visualSignals) || value.visualSignals.length > 5) throw new Error('OPENAI_INVALID_OUTPUT:visualSignals')
  for (const signal of value.visualSignals) {
    if (!signal || typeof signal.label !== 'string' || typeof signal.detail !== 'string' || !['positive','attention','unknown'].includes(signal.state)) {
      throw new Error('OPENAI_INVALID_OUTPUT:visualSignal')
    }
  }

  if (!Array.isArray(value.warnings) || value.warnings.length > 5 || value.warnings.some(x => typeof x !== 'string')) {
    throw new Error('OPENAI_INVALID_OUTPUT:warnings')
  }

  return value
}

export function publicError(code, message, requestId) {
  return { status: 'error', error: { code, message }, requestId }
}
