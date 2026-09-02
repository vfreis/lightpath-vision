import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ProductFamilySchema, ReferenceAgreementSchema, type ProductFamily } from "./schemas.js";

const SupportedFamilySchema = z.enum(["pizza", "calzone", "dolci"]);

const ConfusionSetSchema = z.object({
  id: z.string().min(1),
  family: SupportedFamilySchema,
  members: z.array(z.string().min(1)).min(2).max(8),
  discriminators: z.array(z.string().min(1).max(220)).min(1).max(8)
});

const HardNegativeSchema = z.object({
  id: z.string().min(1),
  confirmed: z.boolean().default(false),
  family: ProductFamilySchema,
  expectedId: z.string().min(1).nullable().default(null),
  predictedId: z.string().min(1).nullable().default(null),
  confusionSet: z.string().min(1).nullable().optional().default(null),
  source: z.string().min(1),
  observations: z.array(z.string().min(1).max(220)).min(1).max(8),
  imageUrl: z.string().url().nullable().optional().default(null)
});

const PolicyRuleSchema = z.object({
  minHeuristicScore: z.number().min(0).max(1),
  minMargin: z.number().min(0).max(1),
  maxContradictions: z.number().int().min(0).max(6).optional(),
  requireOfficialReferenceForAcceptedMatch: z.boolean().optional(),
  acceptedReferenceAgreement: z.array(ReferenceAgreementSchema).optional()
});

const AbstentionPolicySchema = z.object({
  version: z.string().min(1),
  calibrationStatus: z.literal("pending_eval"),
  scoreSemantics: z.literal("vlm_heuristic_not_probability"),
  default: PolicyRuleSchema.extend({
    maxContradictions: z.number().int().min(0).max(6),
    requireOfficialReferenceForAcceptedMatch: z.boolean(),
    acceptedReferenceAgreement: z.array(ReferenceAgreementSchema).min(1)
  }),
  confusionSets: z.record(z.string(), PolicyRuleSchema).default({}),
  notes: z.string().optional()
});

export type ConfusionSet = z.infer<typeof ConfusionSetSchema>;
export type HardNegative = z.infer<typeof HardNegativeSchema>;
export type AbstentionPolicy = z.infer<typeof AbstentionPolicySchema>;

function findDataFile(name: string): string | null {
  const candidates = [
    resolve(process.cwd(), `data/${name}`),
    resolve(process.cwd(), `../data/${name}`)
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function loadJson(name: string): unknown {
  const path = findDataFile(name);
  if (!path) throw new Error(`recognition_data_not_found:${name}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

export const confusionSets = z.array(ConfusionSetSchema).parse(loadJson("confusion-sets.json"));
export const hardNegatives = z.array(HardNegativeSchema).parse(loadJson("hard-negatives.json"));
export const abstentionPolicy = AbstentionPolicySchema.parse(loadJson("abstention-policy.json"));

export function confusionSetsForIds(ids: Iterable<string>, family?: ProductFamily): ConfusionSet[] {
  const idSet = new Set(ids);
  return confusionSets.filter((set) => (!family || set.family === family) && set.members.some((id) => idSet.has(id)));
}

export function expandWithConfusionSets(ids: string[], family: ProductFamily, max = 5): string[] {
  const expanded = [...new Set(ids)];
  for (const set of confusionSetsForIds(expanded, family)) {
    for (const member of set.members) {
      if (!expanded.includes(member)) expanded.push(member);
      if (expanded.length >= max) return expanded.slice(0, max);
    }
  }
  return expanded.slice(0, max);
}

export function relevantHardNegatives(ids: Iterable<string>, family: ProductFamily): HardNegative[] {
  const idSet = new Set(ids);
  const relevantSets = new Set(confusionSetsForIds(idSet, family).map((set) => set.id));
  return hardNegatives.filter((record) => {
    if (!record.confirmed || record.family !== family) return false;
    return Boolean(
      (record.expectedId && idSet.has(record.expectedId)) ||
      (record.predictedId && idSet.has(record.predictedId)) ||
      (record.confusionSet && relevantSets.has(record.confusionSet))
    );
  });
}

export function effectivePolicyFor(ids: Iterable<string>) {
  const sets = confusionSetsForIds(ids);
  let minHeuristicScore = abstentionPolicy.default.minHeuristicScore;
  let minMargin = abstentionPolicy.default.minMargin;

  for (const set of sets) {
    const override = abstentionPolicy.confusionSets[set.id];
    if (!override) continue;
    minHeuristicScore = Math.max(minHeuristicScore, override.minHeuristicScore);
    minMargin = Math.max(minMargin, override.minMargin);
  }

  return {
    ...abstentionPolicy.default,
    minHeuristicScore,
    minMargin,
    confusionSetIds: sets.map((set) => set.id)
  };
}
