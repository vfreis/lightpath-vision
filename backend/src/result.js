export function mapResult(raw, catalog, threshold) {
  const enabled = new Map(catalog.filter(x => x.recognitionEnabled).map(x => [x.slug, x]))
  const chosen = raw.predictedFlavor ? enabled.get(raw.predictedFlavor) : null
  const confidence = Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0
  const safeSuccess = raw.status === 'success' && chosen && confidence >= threshold
  const alternatives = (raw.topCandidates || [])
    .filter(x => enabled.has(x.slug) && x.slug !== chosen?.slug)
    .slice(0, 3)
    .map(x => ({ pizzaId:x.slug, pizzaName:enabled.get(x.slug).displayName, confidenceScore:Number.isFinite(x.confidence) ? x.confidence : null }))
  if (!safeSuccess) {
    return {
      status:'inconclusive', pizzaId:null, pizzaName:null,
      confidenceLabel: confidence >= .6 ? 'medium' : 'low', confidenceScore:confidence || null,
      alternatives, ingredients:[], referenceImage:null,
      qualitySignals:Array.isArray(raw.visualSignals) ? raw.visualSignals : [],
      warnings:[...(raw.warnings || []), 'Não houve confiança suficiente para classificar com segurança.'],
      nutritionSource:null
    }
  }
  return {
    status:'success', pizzaId:chosen.slug, pizzaName:chosen.displayName,
    confidenceLabel: confidence >= .86 ? 'high' : 'medium', confidenceScore:confidence,
    alternatives, ingredients:chosen.ingredients, referenceImage:chosen.referenceImage,
    qualitySignals:Array.isArray(raw.visualSignals) ? raw.visualSignals : [],
    warnings:raw.warnings || [], nutritionSource:null
  }
}
