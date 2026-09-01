import { z } from "zod";

export const QualitySignalSchema = z.object({
  state: z.enum(["positive", "neutral", "attention", "unknown"]),
  observation: z.string().min(1).max(240)
});

export const ModelDecisionSchema = z.object({
  status: z.enum(["matched", "inconclusive"]),
  predictedPizzaId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    pizzaId: z.string().min(1),
    confidence: z.number().min(0).max(1)
  })).max(3),
  evidence: z.array(z.string().min(1).max(180)).max(6),
  qualitySignals: z.object({
    shape: QualitySignalSchema,
    bake: QualitySignalSchema,
    crust: QualitySignalSchema,
    toppingDistribution: QualitySignalSchema,
    expectedIngredients: QualitySignalSchema
  }),
  warnings: z.array(z.string().min(1).max(220)).max(6)
});

export type ModelDecision = z.infer<typeof ModelDecisionSchema>;

export type ConfidenceLabel = "high" | "medium" | "low" | "unavailable";

export type PublicAnalysisResponse = {
  requestId: string;
  status: "success" | "inconclusive";
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
  qualitySignals: ModelDecision["qualitySignals"];
  evidence: string[];
  warnings: string[];
  nutritionSource: null;
  meta: {
    promptVersion: string;
    catalogVersion: string;
  };
};

export type PublicErrorResponse = {
  requestId: string;
  status: "error";
  code: string;
  message: string;
  retryable: boolean;
};
