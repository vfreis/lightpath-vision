export type AnalysisStatus = 'success' | 'inconclusive' | 'error'

export type QualitySignalState = 'positive' | 'neutral' | 'attention' | 'unknown'
export type QualitySignal = { state: QualitySignalState; observation: string }
export type QualitySignals = {
  shape: QualitySignal
  bake: QualitySignal
  crust: QualitySignal
  toppingDistribution: QualitySignal
  expectedIngredients: QualitySignal
}

export type QualityStatus = 'not_calibrated' | 'experimental_compatible' | 'experimental_attention' | 'inconclusive'

export type AnalysisResult = {
  requestId: string
  status: 'success' | 'inconclusive'
  family?: 'pizza' | 'calzone' | 'dolci' | 'other' | 'inconclusive'
  pizzaId: string | null
  pizzaName: string | null
  confidenceLabel: 'high' | 'medium' | 'low' | 'unavailable'
  confidenceScore: number | null
  confidenceCalibrated: false
  alternatives: Array<{ pizzaId: string; pizzaName: string; confidenceScore: number | null }>
  ingredients: string[]
  referenceImage: string | null
  qualitySignals: QualitySignals
  observableSignals?: Record<string, unknown>
  quality_status?: QualityStatus
  quality_notes?: string[]
  evidence: string[]
  warnings: string[]
  nutritionSource: null
  meta: { promptVersion: string; catalogVersion: string }
}

export type ApiError = {
  requestId: string
  status: 'error'
  code: string
  message: string
  retryable: boolean
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
