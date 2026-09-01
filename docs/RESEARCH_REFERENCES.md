# Research References — Braciera Vision

## La Braciera / catalog

- Official menu: https://labraciera.com.br/cardapio
- Full official menu (20 pages): https://labraciera.com.br/cardapio/completo
- Experience / current flavor descriptions: https://experiencia.labraciera.com.br/

The official brand states a 30-flavor savory/sweet menu, while fresh third-party unit listings expose a larger superset that can mix current, unit-specific and retired items. Do not enable a flavor for recognition until it is reconciled against official/current evidence and has adequate reference images.

## Web camera and image pipeline

- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN still-photo capture: https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos
- MDN createImageBitmap: https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
- MDN canvas.toBlob: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob

Implementation lesson: camera requires a secure context; prefer `facingMode: environment` on phones and keep `input[type=file][accept=image/*]` as the gallery/fallback path.

## OpenAI multimodal / structured output

- Vision/image input guide: https://platform.openai.com/docs/guides/images-vision
- Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs

Implementation lesson: constrain the model to a known catalog and validate a strict schema. `inconclusive` must be a first-class output. Keep the API key server-side.

## Motion / interaction

- Motion for React: https://motion.dev/docs/react
- Layout/shared element animations: https://motion.dev/docs/react-layout-animations
- Reduced motion: https://motion.dev/docs/react-use-reduced-motion
- MotionConfig: https://motion.dev/docs/react-motion-config

Implementation lesson: use shared `layoutId` for capture->analysis->result image continuity; prefer transform/opacity; respect the user's reduced-motion setting.

## GitHub Pages

- Vite static deploy / GitHub Pages: https://vite.dev/guide/static-deploy.html#github-pages

For project Pages at `vfreis.github.io/lightpath-vision/`, configure Vite base as `/lightpath-vision/` and deploy via GitHub Actions. With a custom domain, base can become `/`.

## Pizza computer-vision literature

- Sun, D.-W. (2000), *Inspecting pizza topping percentage and distribution by a computer vision method*, Journal of Food Engineering. DOI: https://doi.org/10.1016/S0260-8774(00)00024-8
- Sun & Brosnan (2003), *Pizza quality evaluation using computer vision — Part 1: Pizza base and sauce spread*. DOI: https://doi.org/10.1016/S0260-8774(02)00275-3
- Sun & Brosnan (2003), *Part 2: Pizza topping analysis*. DOI: https://doi.org/10.1016/S0260-8774(02)00276-5
- Du & Sun (2008), *Multi-classification of pizza using computer vision and support vector machine*. DOI: https://doi.org/10.1016/j.jfoodeng.2007.10.001

Useful measurable families: circularity/shape, sauce area/spread, topping exposure percentage and topping distribution. These are research precedents, not La Braciera-approved thresholds.

## Commercial precedent

Domino's DOM Pizza Checker is an important precedent: a camera system positioned above the cut bench was used to recognize/check pizza type and toppings/distribution before delivery and provide quality feedback. Treat it as validation of the business category, not as an architecture to copy blindly.

Reference: https://newsroom.dominos.com.au/blog/dom-pizza-checker-one-year-on

## Product principle

For production, prefer `expected SKU from order/POS -> visual conformance` rather than only open flavor recognition. The prototype can demonstrate recognition because it is visually compelling; the operational product should focus on protecting a known standard.
