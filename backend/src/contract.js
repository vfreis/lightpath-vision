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

export function publicError(code, message, requestId) {
  return { status: 'error', error: { code, message }, requestId }
}
