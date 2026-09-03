import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { extractObservableSignals } from "../src/quality-signals.js";

async function samplePizzaLikeImage(): Promise<Buffer> {
  const size = 320;
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 18);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > 138) continue;
      const offset = (y * size + x) * channels;
      const crust = distance > 112;
      const spotted = crust && ((x * 17 + y * 13) % 71 < 7);
      data[offset] = spotted ? 55 : crust ? 188 : 194;
      data[offset + 1] = spotted ? 37 : crust ? 118 : 65;
      data[offset + 2] = spotted ? 25 : crust ? 72 : 48;
      if (!crust && ((x + y) % 53 < 5)) {
        data[offset] = 225;
        data[offset + 1] = 218;
        data[offset + 2] = 185;
      }
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels } }).jpeg().toBuffer();
}

test("extractor returns all required observable signal families without a quality verdict", async () => {
  const signals = await extractObservableSignals(await samplePizzaLikeImage());
  assert.equal(signals.meta.source, "training_bundle_observable_scaffold");
  assert.equal(signals.meta.calibratedQuality, false);
  assert.ok(signals.blur.laplacianVariance !== null);
  assert.ok(signals.shape.circularity !== null);
  assert.ok(signals.crust.crustWidthProxy !== null);
  assert.ok(signals.leopardSpotting.darkRatio !== null);
  assert.ok(signals.radialDistribution.centerValue !== null);
  assert.ok(typeof signals.semanticCues.ratios.red === "number");
  assert.ok(Array.isArray(signals.semanticCues.cues));
});
