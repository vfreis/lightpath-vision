import type { AnalysisResult, ApiError } from '../types'

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

function secureBaseConfigured() {
  if (!BASE) return false
  return BASE.startsWith('https://') || LOCAL_HTTP.test(BASE)
}

export function apiConfigured() {
  return secureBaseConfigured()
}

export async function analyzePizza(file: File, signal?: AbortSignal): Promise<AnalysisResult> {
  if (!BASE) throw new Error('API_NOT_CONFIGURED')
  if (!secureBaseConfigured()) throw new Error('API_INSECURE_URL')

  const form = new FormData()
  form.append('image', file, file.name)

  const response = await fetch(`${BASE}/api/v1/analyze`, {
    method: 'POST',
    body: form,
    signal,
    headers: { Accept: 'application/json' }
  })

  const data = await response.json().catch(() => null) as AnalysisResult | ApiError | null
  if (!response.ok || !data || data.status === 'error') {
    const code = data && data.status === 'error' ? data.code : `HTTP_${response.status}`
    throw new Error(code)
  }
  return data
}
