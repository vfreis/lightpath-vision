import samples from './demo-samples.json'
import type { DemoSample } from './types'

// This JSON is generated only by scripts/validate-demo-samples.mjs after the exact
// official image is analyzed successfully by the live API. The UI re-hashes the
// image and re-runs the same API during the presentation; stored results are never
// used as a fallback classification.
export const DEMO_SAMPLES = samples as DemoSample[]
