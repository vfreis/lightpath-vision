import sharp, { type Metadata } from "sharp";
import { config } from "./config.js";
import { ApiError } from "./util.js";

const allowedFormats = new Set(["jpeg", "png", "webp"]);

export async function normalizeImage(input: Buffer): Promise<Buffer> {
  if (!input.length) throw new ApiError(400, "empty_image", "A imagem enviada está vazia.", false);

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: "warning" }).metadata();
  } catch {
    throw new ApiError(415, "invalid_image", "O arquivo enviado não pôde ser lido como imagem.", false);
  }

  if (!metadata.format || !allowedFormats.has(metadata.format)) {
    throw new ApiError(415, "unsupported_image_type", "Envie uma imagem JPEG, PNG ou WebP.", false);
  }

  if (!metadata.width || !metadata.height || metadata.width < 160 || metadata.height < 160) {
    throw new ApiError(422, "image_too_small", "A imagem precisa ter pelo menos 160 px em cada dimensão.", false);
  }

  try {
    return await sharp(input, { failOn: "warning" })
      .rotate()
      .resize({
        width: config.MAX_IMAGE_EDGE,
        height: config.MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ApiError(422, "image_normalization_failed", "Não foi possível normalizar esta imagem.", false);
  }
}
