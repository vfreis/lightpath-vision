# A4 Integration & QA — Go / No-Go

## Automated coverage implemented

- Closed-catalog enforcement.
- Low-confidence coercion to `inconclusive`.
- Similar-class alternatives without forced primary.
- Unknown/out-of-catalog slug becomes `inconclusive`.
- Real backend errors stay errors; no fabricated fallback.
- Frontend build + backend tests run in GitHub Actions.
- Repository secret guard rejects an OpenAI-looking key in frontend/backend source.
- CORS allowlist, upload size limit, image decoding/rotation/resize, request timeout and request IDs.

## Mobile implementation checklist

- Rear camera preference: `facingMode: environment`.
- Gallery: `input[type=file][accept=image/*]`.
- Camera + gallery converge on the same normalization pipeline.
- Client max edge 1600 px / JPEG 0.86; server normalizes again with Sharp.
- iOS safe areas + `playsInline` + one-hand controls.
- No critical hover behavior.
- `prefers-reduced-motion` respected in CSS and MotionConfig.
- Loading uses stages but no fake progress percentage.

## Cases represented in contract/tests

1. Recognizable allowed pizza → success when model confidence clears threshold.
2. Visually similar flavors → alternatives; primary is not forced below threshold.
3. Poor photo → prompt requires `inconclusive`.
4. Pizza outside catalog / non-pizza → prompt requires `inconclusive`; unknown slug is rejected server-side.
5. Low confidence → deterministic `inconclusive` enforcement.
6. Network failure → frontend error state.
7. OpenAI 429/error/timeout → explicit API error; no fallback result.

## Current gate

**NO-GO for client presentation as a fully live two-path demo until three external prerequisites are completed:**

1. Deploy the backend on an HTTPS Node host, set `OPENAI_API_KEY`, and set the GitHub Actions variable `VITE_API_BASE_URL` to that public API.
2. Populate `DEMO_SAMPLES` only with real La Braciera images whose exact API results have been run and recorded with hash/provenance.
3. Replace the deliberately neutral presentation tokens with the verified official La Braciera assets/tokens once A1 provides a completed brand handoff. The A1 note observed by A4 contained its initial mission, not final extracted assets.

The code is integration-ready, but claiming LIVE or DEMO SEGURA before these items would violate the project's honesty/no-fake-fallback and brand-fidelity rules.

## Physical-device smoke still required

Run the final flow on at least one Safari iOS device and one Chrome Android device over HTTPS, including permission denied, rotation, gallery selection, network-off, and retake. Browser emulation is not a substitute for camera permission behavior.
