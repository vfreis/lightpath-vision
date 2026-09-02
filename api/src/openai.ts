import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { config } from "./config.js";
import { enabledCatalog, type MenuItem } from "./catalog.js";
import { confusionSets, confusionSetsForIds, type HardNegative } from "./recognition-context.js";
import { buildRerankSystemPrompt, buildTriageSystemPrompt } from "./prompt.js";
import { supervisedReferenceDataUrl } from "./reference-store.js";
import {
  RerankDecisionSchema,
  TriageDecisionSchema,
  type RerankDecision,
  type TriageDecision
} from "./schemas.js";
import { ApiError } from "./util.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) {
    throw new ApiError(503, "openai_not_configured", "A análise visual ainda não está configurada neste ambiente.", false);
  }
  if (!client) {
    client = new OpenAI({ apiKey: config.OPENAI_API_KEY, timeout: config.OPENAI_TIMEOUT_MS, maxRetries: 1 });
  }
  return client;
}

function isRemoteImage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function classifiedImageContent(image: Buffer): any[] {
  return [
    { type: "input_text", text: "IMAGEM A CLASSIFICAR. Siga os gates do schema e não force uma identidade." },
    { type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "high" }
  ];
}

async function primaryReference(item: MenuItem): Promise<{ imageUrl: string; kind: "direct_official" | "supervised_menu_crop" } | null> {
  const remote = item.referenceImages.find(isRemoteImage);
  if (remote) return { imageUrl: remote, kind: "direct_official" };
  const supervised = await supervisedReferenceDataUrl(item.slug);
  return supervised ? { imageUrl: supervised, kind: "supervised_menu_crop" } : null;
}

async function rerankUserContent(image: Buffer, items: MenuItem[], hardNegatives: HardNegative[]): Promise<any[]> {
  const content = classifiedImageContent(image);
  let imageBudget = config.MAX_REFERENCE_IMAGES;

  for (const item of items) {
    const reference = await primaryReference(item);
    content.push({ type: "input_text", text: `CANDIDATO — itemId=${item.slug}; itemName=${item.displayName}; family=${item.family}.` });
    if (!reference || imageBudget <= 0) {
      throw new ApiError(422, "candidate_reference_missing", `Candidato sem referência visual utilizável: ${item.slug}.`, false);
    }
    content.push({
      type: "input_text",
      text: `REFERÊNCIA VISUAL OFICIAL — itemId=${item.slug}; provenance=${reference.kind}. Compare identidade visual; não trate como padrão operacional de qualidade.`
    });
    content.push({ type: "input_image", image_url: reference.imageUrl, detail: "high" });
    imageBudget -= 1;
  }

  for (const record of hardNegatives) {
    if (imageBudget <= 0) break;
    content.push({
      type: "input_text",
      text: `HARD NEGATIVE CONFIRMADO — id=${record.id}; expectedId=${record.expectedId ?? "fora_do_catalogo"}; predictedId=${record.predictedId ?? "n/a"}. Observações: ${record.observations.join(" | ")}`
    });
    if (record.imageUrl && isRemoteImage(record.imageUrl)) {
      content.push({ type: "input_image", image_url: record.imageUrl, detail: "low" });
      imageBudget -= 1;
    }
  }

  return content;
}

function mapOpenAIError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 502;
    if (status === 429) throw new ApiError(503, "openai_rate_limited", "A capacidade de análise está temporariamente indisponível.", true);
    if (status >= 500) throw new ApiError(502, "openai_upstream_error", "A análise visual falhou no provedor de IA.", true);
    throw new ApiError(502, "openai_request_failed", "A análise visual não pôde ser concluída.", false);
  }
  throw new ApiError(502, "openai_unknown_error", "A análise visual falhou inesperadamente.", true);
}

export async function triageWithOpenAI(image: Buffer): Promise<TriageDecision> {
  if (!enabledCatalog.length) throw new ApiError(503, "catalog_not_ready", "Nenhum item está habilitado para reconhecimento.", false);

  try {
    const response = await getClient().responses.parse({
      model: config.OPENAI_MODEL,
      store: false,
      input: [
        { role: "system", content: buildTriageSystemPrompt(enabledCatalog, confusionSets) },
        { role: "user", content: classifiedImageContent(image) }
      ],
      text: { format: zodTextFormat(TriageDecisionSchema, "braciera_recognition_triage") }
    });
    if (!response.output_parsed) throw new ApiError(502, "openai_invalid_triage", "A IA não retornou uma triagem estruturada válida.", true);
    return response.output_parsed;
  } catch (error) {
    return mapOpenAIError(error);
  }
}

export async function rerankWithOpenAI(
  image: Buffer,
  triage: TriageDecision,
  shortlist: MenuItem[],
  hardNegatives: HardNegative[]
): Promise<RerankDecision> {
  if (shortlist.length < 3 || shortlist.length > 5) {
    throw new ApiError(422, "invalid_shortlist", "O reranking exige shortlist entre 3 e 5 candidatos.", false);
  }
  const shortlistIds = shortlist.map((item) => item.slug);
  const sets = confusionSetsForIds(shortlistIds, triage.family);

  try {
    const response = await getClient().responses.parse({
      model: config.OPENAI_MODEL,
      store: false,
      input: [
        { role: "system", content: buildRerankSystemPrompt(shortlist, triage.fingerprint, sets, hardNegatives) },
        { role: "user", content: await rerankUserContent(image, shortlist, hardNegatives) }
      ],
      text: { format: zodTextFormat(RerankDecisionSchema, "braciera_reference_rerank") }
    });
    if (!response.output_parsed) throw new ApiError(502, "openai_invalid_rerank", "A IA não retornou um reranking estruturado válido.", true);
    return response.output_parsed;
  } catch (error) {
    return mapOpenAIError(error);
  }
}
