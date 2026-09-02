import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { finalizeModelDecision } from "./analyze.js";
import { catalogSourcePath, catalogVersion, enabledCatalog, publicCatalog } from "./catalog.js";
import { config } from "./config.js";
import { normalizeImage } from "./image.js";
import { classifyWithOpenAI } from "./openai.js";
import type { PublicErrorResponse } from "./schemas.js";
import { ApiError } from "./util.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new ApiError(403, "origin_not_allowed", "Origem não autorizada para esta API.", false));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400
});
app.use(corsMiddleware);
app.options("/{*splat}", corsMiddleware);

const withRequestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id")?.trim();
  const requestId = incoming && incoming.length <= 80 ? incoming : crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};
app.use(withRequestId);

app.use(rateLimit({
  windowMs: 60_000,
  limit: config.RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req, res, _next, options) {
    const body: PublicErrorResponse = {
      requestId: res.locals.requestId ?? crypto.randomUUID(),
      status: "error",
      code: "rate_limited",
      message: "Muitas análises em pouco tempo.",
      retryable: true
    };
    res.status(options.statusCode).json(body);
  }
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: config.maxUploadBytes }
});

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    recognitionClasses: enabledCatalog.length,
    openaiConfigured: Boolean(config.OPENAI_API_KEY),
    model: config.OPENAI_MODEL,
    catalogVersion
  });
});

app.get("/api/v1/catalog", (_req, res) => {
  res.json({ status: "success", catalogVersion, items: publicCatalog() });
});

app.post("/api/v1/analyze", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "image_required", "Envie a imagem no campo multipart 'image'.", false);
    const normalized = await normalizeImage(req.file.buffer);
    const modelDecision = await classifyWithOpenAI(normalized);
    const result = finalizeModelDecision(res.locals.requestId, modelDecision);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Hostinger single-domain deployment: serve the Vite build from the same Express app.
const frontendDist = resolve(process.cwd(), "frontend/dist");
const frontendIndex = resolve(frontendDist, "index.html");
if (existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path === "/healthz" || req.path.startsWith("/api/")) return next();
    res.sendFile(frontendIndex);
  });
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = res.locals.requestId ?? crypto.randomUUID();

  let normalized: ApiError;
  if (error instanceof ApiError) {
    normalized = error;
  } else if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    normalized = new ApiError(413, "image_too_large", `A imagem excede o limite de ${config.MAX_UPLOAD_MB} MB.`, false);
  } else {
    console.error("Unhandled Braciera Vision API error", { requestId, error });
    normalized = new ApiError(500, "internal_error", "A análise não pôde ser concluída.", true);
  }

  const body: PublicErrorResponse = {
    requestId,
    status: "error",
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable
  };

  res.status(normalized.httpStatus).json(body);
};
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`Braciera Vision listening on :${config.PORT}`);
  console.log(`Catalog: ${catalogSourcePath}; version: ${catalogVersion}; enabled classes: ${enabledCatalog.length}`);
});
