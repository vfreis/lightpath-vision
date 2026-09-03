import assert from "node:assert/strict";
import test from "node:test";
import { enabledCatalog } from "../src/catalog.js";
import { QualityStatusSchema } from "../src/schemas.js";

const expectedFamilies = { pizza: 36, calzone: 2, dolci: 3 } as const;

test("P-GATE runtime catalog matches the frozen 41-class domain", () => {
  assert.equal(enabledCatalog.length, 41);
  for (const [family, expected] of Object.entries(expectedFamilies)) {
    assert.equal(enabledCatalog.filter((item) => item.family === family).length, expected, family);
  }

  const ids = new Set(enabledCatalog.map((item) => item.slug));
  for (const required of [
    "pancetta-e-patate",
    "abbra-cciami",
    "calzone-al-pistacchio",
    "calzone-smores-nutella-lindt",
    "tiramissu",
    "pistacchio-tiramissu",
    "torta-cheesecake"
  ]) assert.equal(ids.has(required), true, required);

  assert.equal(ids.has("la-diciannove"), false);
  assert.equal(ids.has("nocciola-chocolat-du-jour"), false);
});

test("P-GATE quality_status is restricted to the non-certifying contract", () => {
  const allowed = [
    "not_calibrated",
    "experimental_compatible",
    "experimental_attention",
    "inconclusive"
  ];
  assert.deepEqual(allowed.map((value) => QualityStatusSchema.parse(value)), allowed);

  for (const forbidden of ["approved", "rejected", "good", "bad", "aprovada", "reprovada"]) {
    assert.equal(QualityStatusSchema.safeParse(forbidden).success, false, forbidden);
  }
});
