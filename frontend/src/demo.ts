import type { DemoSample } from './types'

// Safe-demo entries must be added only after the exact image has been analyzed by
// the live backend. Each entry carries image hash + validation timestamp + result.
// Empty by design until A1/A3 provide real validated images/results.
export const DEMO_SAMPLES: DemoSample[] = []
