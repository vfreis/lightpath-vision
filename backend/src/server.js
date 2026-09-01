import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import multer from 'multer'
import sharp from 'sharp'
import catalog from './catalog.json' with { type: 'json' }
import { publicError } from './contract.js'
import { classifyWithOpenAI } from './openai.js'
import { mapResult } from './result.js'
import { PROMPT_VERSION } from './prompt.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024)
const threshold = Number(process.env.CONFIDENCE_THRESHOLD || 0.78)
const minTopMargin = Number(process.env.MIN_TOP_MARGIN || 0.10)
const maxReferenceImages = Number(process.env.MAX_REFERENCE_IMAGES || 8)
const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 45000)
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna'
const origins = (process.env.ALLOWED_ORIGINS || 'https://vfreis.github.io,http://localhost:5173').split(',').map(x => x.trim()).filter(Boolean)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize:maxBytes, files:1 } })

app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy:false }))
app.use(cors({
  origin(origin, cb){ if (!origin || origins.includes(origin)) return cb(null, true); cb(new Error('CORS_ORIGIN_DENIED')) },
  methods:['GET','POST','OPTIONS'],
  allowedHeaders:['Content-Type','X-Request-Id'],
  exposedHeaders:['X-Request-Id'],
  maxAge:86400
}))

app.get('/health', (_req,res) => res.json({ ok:true, service:'braciera-vision-api', promptVersion:PROMPT_VERSION, modelConfigured:Boolean(process.env.OPENAI_API_KEY), recognitionClasses:catalog.filter(x => x.recognitionEnabled).length }))

app.post('/v1/analyze', upload.single('image'), async (req,res) => {
  const requestId = crypto.randomUUID()
  res.setHeader('x-request-id', requestId)
  if (!process.env.OPENAI_API_KEY) return res.status(503).json(publicError('OPENAI_NOT_CONFIGURED','Serviço de IA não configurado.',requestId))
  if (!req.file) return res.status(400).json(publicError('IMAGE_REQUIRED','Envie uma imagem JPEG, PNG ou WebP.',requestId))
  if (!req.file.mimetype.startsWith('image/')) return res.status(415).json(publicError('UNSUPPORTED_MEDIA_TYPE','O upload precisa ser uma imagem.',requestId))

  let normalized
  try {
    const source = sharp(req.file.buffer, { failOn:'error' })
    const metadata = await source.metadata()
    if (!metadata.width || !metadata.height || metadata.width < 160 || metadata.height < 160) {
      return res.status(422).json(publicError('IMAGE_TOO_SMALL','A imagem precisa ter pelo menos 160 px em cada dimensão.',requestId))
    }
    normalized = await source.rotate().resize({ width:1600, height:1600, fit:'inside', withoutEnlargement:true }).flatten({ background:'#ffffff' }).jpeg({ quality:86, mozjpeg:true }).toBuffer()
  } catch {
    return res.status(422).json(publicError('INVALID_IMAGE','A imagem não pôde ser decodificada ou normalizada.',requestId))
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), openaiTimeoutMs)
    let ai
    try {
      ai = await classifyWithOpenAI({ imageBase64:normalized.toString('base64'), mimeType:'image/jpeg', catalog, apiKey:process.env.OPENAI_API_KEY, model, signal:controller.signal, maxReferenceImages })
    } finally { clearTimeout(timeout) }
    const result = mapResult(ai.parsed, catalog, threshold, minTopMargin)
    return res.json({ ...result, requestId, model, promptVersion:PROMPT_VERSION })
  } catch (error) {
    console.error(JSON.stringify({ requestId, error:error?.message, status:error?.status }))
    if (error?.name === 'AbortError') return res.status(504).json(publicError('OPENAI_TIMEOUT','A análise excedeu o tempo limite.',requestId))
    if (error?.status === 429) return res.status(503).json(publicError('OPENAI_RATE_LIMIT','A IA está temporariamente indisponível.',requestId))
    if (error?.status) return res.status(502).json(publicError('OPENAI_ERROR','A IA não concluiu a análise.',requestId))
    if (String(error?.message || '').startsWith('OPENAI_INVALID_') || error?.message === 'OPENAI_EMPTY_OUTPUT') {
      return res.status(502).json(publicError('OPENAI_INVALID_RESPONSE','A IA retornou uma resposta estruturada inválida.',requestId))
    }
    return res.status(500).json(publicError('INTERNAL_ERROR','Falha interna ao processar a análise.',requestId))
  }
})

app.use((error, _req, res, _next) => {
  const requestId = crypto.randomUUID()
  res.setHeader('x-request-id', requestId)
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json(publicError('IMAGE_TOO_LARGE','Imagem acima do limite de upload.',requestId))
  if (error?.message === 'CORS_ORIGIN_DENIED') return res.status(403).json(publicError('CORS_DENIED','Origem não autorizada.',requestId))
  console.error(error)
  res.status(500).json(publicError('INTERNAL_ERROR','Falha interna.',requestId))
})

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Braciera Vision API on :${port}`))
export { app }
