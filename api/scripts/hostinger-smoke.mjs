import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import sharp from "sharp";

const PORT = 3000;
const ORIGIN = "https://vfreis.github.io";
const BASE_URL = `http://127.0.0.1:${PORT}`;

const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(PORT),
  ALLOWED_ORIGINS: ORIGIN
};
delete childEnv.OPENAI_API_KEY;

let output = "";
const child = spawn(process.execPath, ["dist/src/server.js"], {
  cwd: process.cwd(),
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"]
});
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server_exited_early:${child.exitCode}\n${output}`);
    try {
      const response = await fetch(`${BASE_URL}/healthz`, { headers: { Origin: ORIGIN } });
      if (response.ok) return response;
    } catch {
      // Server still booting.
    }
    await sleep(250);
  }
  throw new Error(`healthz_timeout\n${output}`);
}

try {
  const healthResponse = await waitForHealth();
  assert.equal(healthResponse.headers.get("access-control-allow-origin"), ORIGIN);
  const health = await healthResponse.json();
  assert.equal(health.status, "ok");
  assert.equal(health.catalogItems, 36);
  assert.equal(health.recognitionClasses, 36);
  assert.equal(health.expectedRecognitionClasses, 36);
  assert.equal(health.openaiConfigured, false);
  assert.equal(health.port, 3000);
  assert.ok(String(health.node).startsWith("22."), `Expected Node 22, received ${health.node}`);

  const catalogResponse = await fetch(`${BASE_URL}/api/v1/catalog`, { headers: { Origin: ORIGIN } });
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.status, "success");
  assert.equal(catalog.items.length, 36);
  assert.equal(new Set(catalog.items.map((item) => item.pizzaId)).size, 36);

  const image = await sharp({
    create: {
      width: 320,
      height: 320,
      channels: 3,
      background: { r: 190, g: 120, b: 70 }
    }
  }).jpeg({ quality: 85 }).toBuffer();
  const form = new FormData();
  form.append("image", new Blob([image], { type: "image/jpeg" }), "hostinger-smoke.jpg");
  const analyzeResponse = await fetch(`${BASE_URL}/api/v1/analyze`, {
    method: "POST",
    headers: { Origin: ORIGIN },
    body: form
  });
  assert.equal(analyzeResponse.status, 503);
  const analyze = await analyzeResponse.json();
  assert.equal(analyze.status, "error");
  assert.equal(analyze.code, "openai_not_configured");
  assert.equal(analyze.retryable, false);
  assert.ok(analyze.requestId);

  console.log("Hostinger smoke passed: Node 22 / port 3000 / healthz / 36-item catalog / analyze secret guard.");
} finally {
  child.kill("SIGTERM");
}
