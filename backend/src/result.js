function unique(values) { return [...new Set(values.filter(Boolean))] }

export function mapResult(raw, catalog, threshold, minTopMargin = 0.10) {
  const enabled = new Map(catalog.filter(x => x.recognitionEnabled).map(x => [x.slug, x]))
  const chosen = raw.predictedFlavor ? enabled.get(raw.predictedFlavor) : null
  const confidence = Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0
  const validCandidates = (raw.topCandidates || [])
    .filter(x => enabled.has(x.slug) && x.slug !== chosen?.slug)
    .sort((a,b) => b.confidence - a.confidence)
  const nextBest = validCandidates[0]
  const margin = nextBest ? confidence - nextBest.confidence : 1
  const ambiguous = Boolean(chosen && nextBest && margin < minTopMargin)
  const safeSuccess = raw.status === 'success' && chosen && confidence >= threshold && !ambiguous

  const alternatives = validCandidates.slice(0, 3).map(x => ({
    pizzaId:x.slug,
    pizzaName:enabled.get(x.slug).displayName,
    confidenceScore:null
  }))

  const commonWarnings = [
    ...(raw.warnings || []),
    'A confiança numérica ainda não é calibrada; o MVP exibe apenas uma faixa qualitativa.',
    'Os sinais de qualidade são experimentais e não representam critérios oficiais da La Braciera.'
  ]
  if (ambiguous) commonWarnings.push('Os principais candidatos ficaram visualmente próximos; o resultado foi marcado como inconclusivo.')

  if (!safeSuccess) {
    return {
      status:'inconclusive', pizzaId:null, pizzaName:null,
      confidenceLabel: confidence < threshold ? 'low' : 'unavailable', confidenceScore:null,
      confidenceCalibrated:false,
      alternatives, ingredients:[], referenceImage:null,
      qualitySignals:Array.isArray(raw.visualSignals) ? raw.visualSignals : [],
      warnings:unique([...commonWarnings, 'Não houve evidência suficiente para classificar com segurança.']),
      nutritionSource:null
    }
  }
  return {
    status:'success', pizzaId:chosen.slug, pizzaName:chosen.displayName,
    confidenceLabel: confidence >= .90 ? 'high' : 'medium', confidenceScore:null,
    confidenceCalibrated:false,
    alternatives, ingredients:Array.isArray(chosen.ingredients) ? chosen.ingredients : [],
    referenceImage:chosen.referenceImage || (Array.isArray(chosen.referenceImages) ? chosen.referenceImages[0] || null : null),
    qualitySignals:Array.isArray(raw.visualSignals) ? raw.visualSignals : [],
    warnings:unique(commonWarnings), nutritionSource:null
  }
}
