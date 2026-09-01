import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { config } from "./config.js";
import { enabledCatalog } from "./catalog.js";
import { buildSystemPrompt } from "./prompt.js";
import { ModelDecisionSchema, type ModelDecision } from "./schemas.js";
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

function buildUserContent(image: Buffer): any[] {
  const content: any[] = [
    {
      type: "input_text",
      text: "IMAGEM A CLASSIFICAR: analise esta pizza segundo o catálogo permitido e o schema."
    },
    {
      type: "input_image",
      image_url: `data:image/jpeg;base64,${image.toString("base64")}`,
      detail: "high"
    }
  ];

  let referenceCount = 0;
  for (const item of enabledCatalog) {
    if (referenceCount >= config.MAX_REFERENCE_IMAGES) break;
    const reference = item.referenceImages.find(isRemoteImage);
    if (!reference) continue;
    content.push({
      type: "input_text",
      text: `REFERÊNCIA VISUAL — pizzaId=${item.slug}; pizzaName=${item.displayName}. Use apenas como comparação visual do catálogo, não como prova de conformidade operacional.`
    });
    content.push({
      type: "input_image",
      image_url: reference,
      detail: "low"
    });
    referenceCount += 1;
  }

  if (referenceCount === 0) {
    content.push({
      type: "input_text",
      text: "Nenhuma referência visual remota está disponível nesta versão do catálogo. Seja conservador e retorne inconclusive quando os componentes visuais não distinguirem claramente uma classe."
    });
  }

  return content;
}

export async function classifyWithOpenAI(image: Buffer): Promise<ModelDecision> {
  if (!enabledCatalog.length) {
    throw new ApiError(503, "catalog_not_ready", "Nenhuma pizza está habilitada para reconhecimento.", false);
  }

  const openai = getClient();

  try {
    const response = await openai.responses.parse({
      model: config.OPENAI_MODEL,
      store: false,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(enabledCatalog)
        },
        {
          role: "user",
          content: buildUserContent(image)
        }
      ],
      text: {
        format: zodTextFormat(ModelDecisionSchema, "braciera_pizza_analysis")
      }
    });

    if (!response.output_parsed) {
      throw new ApiError(502, "openai_invalid_response", "A IA não retornou uma resposta estruturada válida.", true);
    }

    return response.output_parsed;
  } catch (error) {
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
}
