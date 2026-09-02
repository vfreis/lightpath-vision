import type { AnalysisResult, ApiError } from '../types'

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim()
const BASE = RAW_BASE.replace(/\/$/, '')

export function apiConfigured() {
  // On Hostinger the frontend and API share the same origin, so an empty base is valid.
  return true
}

export async function analyzePizza(file: File, signal?: AbortSignal): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('image', file, file.name)
  const response = await fetch(`${BASE}/api/v1/analyze`, { method: 'POST', body: form, signal })
  const data = await response.json().catch(() => null) as AnalysisResult | ApiError | null
  if (!response.ok || !data || data.status === 'error') {
    const code = data && data.status === 'error' ? data.code : `HTTP_${response.status}`
    throw new Error(code)
  }
  return data
}
