import type { MenuItem } from "./catalog.js";
import type { HierarchicalDecision, QualityStatus } from "./schemas.js";
import type { ObservableSignals } from "./quality-signals.js";

export const QUALITY_CALIBRATION_STATUS = "not_calibrated" as const;

const forbiddenVerdictTerms = [
  "aprovada",
  "aprovado",
  "reprovada",
  "reprovado",
  "certificada",
  "certificado",
  "approved",
  "rejected",
  "certified"
];

export type QualityContractResult = {
  qualityStatus: QualityStatus;
  qualityNotes: string[];
};

function safeNote(note: string): string {
  const lowered = note.toLocaleLowerCase("pt-BR");
  if (forbiddenVerdictTerms.some((term) => lowered.includes(term))) {
    throw new Error("forbidden_quality_verdict_language");
  }
  return note;
}

function selectedReferenceAgreement(decision: HierarchicalDecision, selected: MenuItem | null) {
  if (!decision.rerank || !selected) return "unavailable" as const;
  return decision.rerank.ranking.find((candidate) => candidate.itemId === selected.slug)?.referenceAgreement ?? "unavailable";
}

function observableNotes(signals: ObservableSignals): string[] {
  const notes: string[] = [];

  if (signals.blur.state === "limited") {
    notes.push("A foto está com nitidez limitada; vale repetir a captura para conferir melhor o cornicione e a montagem.");
  } else if (signals.crust.state === "observed") {
    notes.push("Cornicione visível: a POC consegue ler largura, textura e contraste do anel externo.");
  }

  if (signals.leopardSpotting.state === "observed" && signals.leopardSpotting.darkRatio !== null) {
    notes.push("Pontos de forno visíveis no cornicione; a intensidade é tratada apenas como sinal experimental de leitura da brasa.");
  }

  if (signals.radialDistribution.state === "observed") {
    notes.push("Centro, faixa intermediária e borda foram lidos separadamente para conferir a distribuição da montagem.");
  }

  if (signals.semanticCues.cues.length) {
    notes.push(`Cores e ingredientes aparentes na imagem: ${signals.semanticCues.cues.join(", ")}; ingredientes ocultos não são inferidos.`);
  }

  if (signals.shape.state === "limited" || signals.shape.state === "not_visible") {
    notes.push("A forma completa da pizza não está suficientemente visível para uma leitura estável de circularidade.");
  }

  return notes.map(safeNote).slice(0, 5);
}

export function buildQualityContract(
  decision: HierarchicalDecision,
  selected: MenuItem | null,
  acceptedRecognition: boolean
): QualityContractResult {
  const signals = decision.observableSignals;
  const notes = observableNotes(signals);

  if (!acceptedRecognition || decision.triage.imageQuality.decision !== "pass") {
    return {
      qualityStatus: "inconclusive",
      qualityNotes: [
        ...notes,
        safeNote("Sem identificação visual suficientemente segura, a POC não compara padrão de montagem; qualidade operacional continua não calibrada.")
      ].slice(0, 6)
    };
  }

  if (!selected || !decision.referenceGrounded) {
    return {
      qualityStatus: "not_calibrated",
      qualityNotes: [
        ...notes,
        safeNote("A leitura de qualidade está em treinamento e ainda não possui referência/calibração suficiente para esta classe.")
      ].slice(0, 6)
    };
  }

  const agreement = selectedReferenceAgreement(decision, selected);
  const keySignalsReadable =
    signals.blur.state === "observed" &&
    signals.crust.state === "observed" &&
    signals.shape.state === "observed" &&
    signals.radialDistribution.state === "observed";

  const hasVisualAttention =
    !keySignalsReadable ||
    (decision.rerank?.contradictions.length ?? 0) > 0 ||
    agreement === "weak" ||
    agreement === "none" ||
    agreement === "unavailable";

  if (hasVisualAttention) {
    return {
      qualityStatus: "experimental_attention",
      qualityNotes: [
        ...notes,
        safeNote("A montagem apresenta sinais que merecem conferência contra a referência da casa; esta indicação é experimental e não é uma reprovação."),
        safeNote("Qualidade operacional ainda não calibrada com fotos boas/ruins validadas pela La Braciera.")
      ].slice(0, 6)
    };
  }

  return {
    qualityStatus: "experimental_compatible",
    qualityNotes: [
      ...notes,
      safeNote("A leitura visual da POC está compatível com a referência usada nesta comparação, sem certificar qualidade operacional."),
      safeNote("Qualidade operacional ainda não calibrada com fotos boas/ruins validadas pela La Braciera.")
    ].slice(0, 6)
  };
}

export function assertNoQualityCertification(notes: string[]): void {
  for (const note of notes) safeNote(note);
}
