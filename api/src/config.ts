import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.literal("gpt-4.1-mini").default("gpt-4.1-mini"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  MENU_CATALOG_PATH: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(8),
  MAX_IMAGE_EDGE: z.coerce.number().int().min(640).max(4096).default(1600),
  MAX_REFERENCE_IMAGES: z.coerce.number().int().min(0).max(20).default(8),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(300).default(20),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid API environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("invalid_environment");
}

export const config = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean),
  maxUploadBytes: Math.round(parsed.data.MAX_UPLOAD_MB * 1024 * 1024)
};
