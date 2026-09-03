import { z } from "zod";
import type { ObservableSignals } from "./quality-signals.js";

export const QualitySignalSchema = z.object({
  state: z.enum(["positive", "neutral", "attention", "unknown"]),
  observation: z.string().min(1).max(240)
});

export const QualityStatusSchema = z.enum([
  "not_calibrated",
  "experimental_compatible",
  "experimental_attention",
  "inconclusive"
]);
export type QualityStatus = z.infer<typeof QualityStatusSchema>;

export const ProductFamilySchema = z.enum(["pizza", "calzone", "dolci", "other", "inconclusive"]);
export type ProductFamily = z.infer<typeof ProductFamilySchema>;

export const ImageQualitySchema = z.object({
  decision: z.enum(["pass", "retry", "inconclusive"]),
  reasonCodes: z.array(z.string().min(1).max(80)).max(8),
  observations: z.array(z.string().min(1).max(180)).max(8)
});

export const VisualFingerprintSchema = z.object({
  form: z.array(z.string().min(1).max(120)).max(6),
  baseAndCheese: z.array(z.string().min(1).max(120)).max(8),
  proteins: z.array(z.string().min(1).max(120)).max(8),
  vegetablesAndHerbs: z.array(z.string().min(1).max(120)).max(8),
  creamsAndCenters: z.array(z.string().min(1).max(120)).max(8),
  sweetElements: z.array(z.string().min(1).max(120)).max(8),
  coveragePattern: z.array(z.string().min(1).max(120)).max(6),
  distinctiveSignals: z.array(z.string().min(1).max(140)).max(8),
  notVisible: z.array(z.string().min(1).max(120)).max(8)
});

export const ShortlistCandidateSchema = z.object({
  itemId: z.string().min(1),
  heuristicScore: z.number().min(0).max(1),
  reasons: z.array(z.string().min(1).max(160)).min(1).max(4)
});

export const TriageDecisionSchema = z.object({
  imageQuality: ImageQualitySchema,
  family: ProductFamilySchema,
  fingerprint: VisualFingerprintSchema,
  shortlist: z.array(ShortlistCandidateSchema).max(5),
  warnings: z.array(z.string().min(1).max(220)).max(6)
});
export type TriageDecision = z.infer<typeof TriageDecisionSchema>;

export const ReferenceAgreementSchema = z.enum(["strong", "partial", "weak", "none", "unavailable"]);

export const RerankCandidateSchema = z.object({
  itemId: z.string().min(1),
  heuristicScore: z.number().min(0).max(1),
  referenceAgreement: ReferenceAgreementSchema,
  evidenceFor: z.array(z.string().min(1).max(180)).max(5),
  evidenceAgainst: z.array(z.string().min(1).max(180)).max(5)
});

export const RerankDecisionSchema = z.object({
  status: z.enum(["matched", "inconclusive"]),
  selectedId: z.string().nullable(),
  selectedHeuristicScore: z.number().min(0).max(1),
  runnerUpId: z.string().nullable(),
  runnerUpHeuristicScore: z.number().min(0).max(1),
  ranking: z.array(RerankCandidateSchema).min(1).max(5),
  decisionEvidence: z.array(z.string().min(1).max(180)).max(6),
  contradictions: z.array(z.string().min(1).max(180)).max(6),
  warnings: z.array(z.string().min(1).max(220)).max(6)
});
export type RerankDecision = z.infer<typeof RerankDecisionSchema>;

export type HierarchicalDecision = {
  triage: TriageDecision;
  rerank: RerankDecision | null;
  shortlistIds: string[];
  hardNegativeIds: string[];
  abstentionReasons: string[];
  referenceGrounded: boolean;
  observableSignals: ObservableSignals;
};

export type ConfidenceLabel = "high" | "medium" | "low" | "unavailable";

export type PublicAnalysisResponse = {
  requestId: string;
  status: "success" | "inconclusive";
  family: ProductFamily;
  recognitionStatus: "recognized" | "inconclusive";
  predictedItem: { itemId: string; displayName: string } | null;
  reference: { imageUrl: string; role: "identity_reference" } | null;
  observableSignals: ObservableSignals;
  quality_status: QualityStatus;
  quality_notes: string[];
  pizzaId: string | null;
  pizzaName: string | null;
  confidenceLabel: ConfidenceLabel;
  confidenceScore: number | null;
  confidenceCalibrated: false;
  alternatives: Array<{
    pizzaId: string;
    pizzaName: string;
    confidenceScore: number | null;
  }>;
  ingredients: string[];
  referenceImage: string | null;
  qualitySignals: {
    shape: z.infer<typeof QualitySignalSchema>;
    bake: z.infer<typeof QualitySignalSchema>;
    crust: z.infer<typeof QualitySignalSchema>;
    toppingDistribution: z.infer<typeof QualitySignalSchema>;
    expectedIngredients: z.infer<typeof QualitySignalSchema>;
  };
  evidence: string[];
  warnings: string[];
  nutritionSource: null;
  recognition: {
    family: ProductFamily;
    imageQuality: z.infer<typeof ImageQualitySchema>;
    observedFingerprint: z.infer<typeof VisualFingerprintSchema>;
    shortlist: Array<{ itemId: string; itemName: string }>;
    referenceGrounded: boolean;
    hardNegativeIds: string[];
    abstentionReasons: string[];
    calibrationStatus: "pending_eval";
    calibratedProbability: null;
  };
  meta: {
    promptVersion: string;
    catalogVersion: string;
    abstentionPolicyVersion: string;
    qualitySignalContractVersion: string;
    trainingBundleQualityVersion: string;
    qualityCalibrationStatus: "not_calibrated";
  };
};

export type PublicErrorResponse = {
  requestId: string;
  status: "error";
  code: string;
  message: string;
  retryable: boolean;
};
