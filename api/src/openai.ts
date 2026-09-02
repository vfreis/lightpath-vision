import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { config } from "./config.js";
import { enabledCatalog, type MenuItem } from "./catalog.js";
import { confusionSets, confusionSetsForIds, type HardNegative } from "./recognition-context.js";
import { buildRerankSystemPrompt, buildTriageSystemPrompt } from "./prompt.js";
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
    client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
      timeout: config.OPENAI_TIMEOUT_MS,
      maxRetries: 1
    });
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
    {
      type: "input_text",
      text: "IMAGEM A CLASSIFICAR. Siga os gates do schema e não force uma identidade."
    },
    {
      type: "input_image",
      image_url: `data:image/jpeg;base64,${image.toString("base64")}`,
      detail: "high"
    }
  ];
}

function rerankUserContent(image: Buffer, items: MenuItem[], hardNegatives: HardNegative[]): any[] {
  const content = classifiedImageContent(image);
  let imageBudget = config.MAX_REFERENCE_IMAGES;
  const referencesByItem = new Map(
    items.map((item) => [item.slug, item.referenceImages.filter(isRemoteImage).slice(0, 2)])
  );

  // First pass: guarantee one official positive reference for every candidate that has one.
  for (const item of items) {
    const references = referencesByItem.get(item.slug) ?? [];
    content.push({
      type: "input_text",
      text: `CANDIDATO — itemId=${item.slug}; itemName=${item.displayName}; family=${item.family}.`
    });

    const primaryReference = references[0];
    if (primaryReference && imageBudget > 0) {
      content.push({
        type: "input_text",
        text: `REFERÊNCIA OFICIAL POSITIVA PRINCIPAL — itemId=${item.slug}. Use como evidência de identidade visual, não como padrão operacional.`
      });
      content.push({ type: "input_image", image_url: primaryReference, detail: "low" });
      imageBudget -= 1;
    } else if (!primaryReference) {
      content.push({
        type: "input_text",
        text: `SEM REFERÊNCIA OFICIAL REMOTA para itemId=${item.slug}. Para esse candidato use referenceAgreement=unavailable.`
      });
    } else {
      content.push({
        type: "input_text",
        text: `REFERÊNCIA OFICIAL NÃO ENVIADA POR LIMITE DE ORÇAMENTO para itemId=${item.slug}. Use referenceAgreement=unavailable e não considere este candidato grounded.`
      });
    }
  }

  // Second pass: only after every referenced candidate received one image, spend remaining budget on a second view.
  for (const item of items) {
    if (imageBudget <= 0) break;
    const secondaryReference = (referencesByItem.get(item.slug) ?? [])[1];
    if (!secondaryReference) continue;
    content.push({
      type: "input_text",
      text: `REFERÊNCIA OFICIAL POSITIVA ADICIONAL — itemId=${item.slug}.`
    });
    content.push({ type: "input_image", image_url: secondaryReference, detail: "low" });
    imageBudget -= 1;
  }

  for (const record of hardNegatives) {
    content.push({
      type: "input_text",
      text: `HARD NEGATIVE CONFIRMADO — id=${record.id}; expectedId=${record.expectedId ?? "fora_do_catalogo"}; predictedId=${record.predictedId ?? "n/a"}. Observações: ${record.observations.join(" | ")}`
    });
    if (record.imageUrl && isRemoteImage(record.imageUrl) && imageBudget > 0) {
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
    if (status === 429) {
      throw new ApiError(503, "openai_rate_limited", "A capacidade de análise está temporariamente indisponível.", true);
    }
    if (status >= 500) {
      throw new ApiError(502, "openai_upstream_error", "A análise visual falhou no provedor de IA.", true);
    }
    throw new ApiError(502, "openai_request_failed", "A análise visual não pôde ser concluída.", false);
  }
  throw new ApiError(502, "openai_unknown_error", "A análise visual falhou inesperadamente.", true);
}

export async function triageWithOpenAI(image: Buffer): Promise<TriageDecision> {
  if (!enabledCatalog.length) {
    throw new ApiError(503, "catalog_not_ready", "Nenhum item está habilitado para reconhecimento.", false);
  }

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

    if (!response.output_parsed) {
      throw new ApiError(502, "openai_invalid_triage", "A IA não retornou uma triagem estruturada válida.", true);
    }
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
        {
          role: "system",
          content: buildRerankSystemPrompt(shortlist, triage.fingerprint, sets, hardNegatives)
        },
        {
          role: "user",
          content: rerankUserContent(image, shortlist, hardNegatives)
        }
      ],
      text: { format: zodTextFormat(RerankDecisionSchema, "braciera_reference_rerank") }
    });

    if (!response.output_parsed) {
      throw new ApiError(502, "openai_invalid_rerank", "A IA não retornou um reranking estruturado válido.", true);
    }
    return response.output_parsed;
  } catch (error) {
    return mapOpenAIError(error);
  }
}
