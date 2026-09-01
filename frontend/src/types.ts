export type AnalysisStatus = 'success' | 'inconclusive' | 'error'

export type QualitySignal = {
  label: string
  state: 'positive' | 'attention' | 'unknown'
  detail: string
}

export type AnalysisResult = {
  status: AnalysisStatus
  pizzaId: string | null
  pizzaName: string | null
  confidenceLabel: 'high' | 'medium' | 'low' | 'unavailable'
  confidenceScore: number | null
  alternatives: Array<{ pizzaId: string; pizzaName: string; confidenceScore: number | null }>
  ingredients: string[]
  referenceImage: string | null
  qualitySignals: QualitySignal[]
  warnings: string[]
  nutritionSource: null
  requestId?: string
}

export type DemoSample = {
  id: string
  name: string
  image: string
  sha256: string
  validatedAt: string
  validatedResult: AnalysisResult
  provenance: string
}
