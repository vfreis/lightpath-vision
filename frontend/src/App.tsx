import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Camera, CheckCircle2, ChevronDown, Image as ImageIcon, RotateCcw, ShieldCheck, Sparkles, Upload, XCircle } from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { analyzePizza, apiConfigured } from './lib/api'
import { canvasCapture, normalizeImage } from './lib/image'
import { DEMO_SAMPLES } from './demo'
import type { AnalysisResult, QualitySignals } from './types'

type View = 'home' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'

const stages = ['Lendo formato', 'Comparando com o cardápio', 'Avaliando padrão visual']
const qualityLabels: Record<keyof QualitySignals, string> = {
  shape: 'Formato / circularidade',
  bake: 'Assamento visual',
  crust: 'Borda / cornicione',
  toppingDistribution: 'Distribuição de ingredientes',
  expectedIngredients: 'Ingredientes esperados visíveis'
}

function confidenceText(result: AnalysisResult) {
  if (result.status === 'inconclusive') return 'Inconclusivo'
  if (!result.confidenceCalibrated || result.confidenceScore == null) {
    const labels = { high: 'Confiança visual alta', medium: 'Confiança visual média', low: 'Confiança visual baixa', unavailable: 'Confiança indisponível' }
    return labels[result.confidenceLabel]
  }
  return `${Math.round(result.confidenceScore * 100)}% de confiança`
}

export default function App() {
  const reduced = useReducedMotion()
  const [view, setView] = useState<View>('home')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [captureFlash, setCaptureFlash] = useState(false)
  const [stage, setStage] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const canLive = apiConfigured()
  const canSafeDemo = DEMO_SAMPLES.length > 0

  const cleanupCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  useEffect(() => () => {
    cleanupCamera()
    controllerRef.current?.abort()
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    if (view !== 'analyzing') return
    const timer = window.setInterval(() => setStage(s => Math.min(2, s + 1)), 1500)
    return () => window.clearInterval(timer)
  }, [view])

  async function openCamera() {
    setCameraError('')
    setCameraReady(false)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não disponível neste navegador. Use a galeria.')
      setView('camera')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      setView('camera')
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch (e) {
      setCameraError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Permissão da câmera negada. Você pode liberar nas configurações ou usar a galeria.'
        : 'Não foi possível abrir a câmera. Use a galeria para continuar.')
      setView('camera')
    }
  }

  function setNormalized(next: File) {
    cleanupCamera()
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setResult(null)
    setView('preview')
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.files?.[0]
    event.target.value = ''
    if (!raw) return
    if (!raw.type.startsWith('image/')) return setErrorAndView('O arquivo selecionado não é uma imagem.')
    try {
      setNormalized(await normalizeImage(raw, raw.name))
    } catch {
      setErrorAndView('Não foi possível preparar esta imagem. Tente outra foto.')
    }
  }

  async function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !cameraReady) return
    setCaptureFlash(true)
    window.setTimeout(() => setCaptureFlash(false), 150)
    try { setNormalized(await canvasCapture(video)) }
    catch { setErrorAndView('A captura falhou. Tente novamente ou use a galeria.') }
  }

  function reset() {
    controllerRef.current?.abort()
    cleanupCamera()
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null); setFile(null); setResult(null); setError(''); setStage(0); setView('home')
  }

  function setErrorAndView(message: string) {
    setError(message)
    setView('error')
  }

  async function analyze() {
    if (!file) return
    if (!canLive) return setErrorAndView('A API remota ainda não está configurada para este deploy.')
    setStage(0)
    setView('analyzing')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const data = await analyzePizza(file, controller.signal)
      setResult(data)
      setView('result')
    } catch (e) {
      if (controller.signal.aborted) return
      const code = e instanceof Error ? e.message : 'UNKNOWN_ERROR'
      const friendly = code === 'API_NOT_CONFIGURED' ? 'A API remota não está configurada.'
        : code === 'API_INSECURE_URL' ? 'A API precisa estar disponível por HTTPS para funcionar neste deploy.'
        : code === 'openai_rate_limited' || code === 'rate_limited' ? 'A IA está temporariamente ocupada. Tente novamente.'
        : code.startsWith('openai_') ? 'A análise de IA falhou. Nenhum resultado foi inventado.'
        : code === 'origin_not_allowed' ? 'Este endereço do app ainda não está autorizado pelo backend.'
        : code === 'invalid_image' || code === 'unsupported_image_type' ? 'A imagem não pôde ser processada. Tente outra foto.'
        : 'Falha de rede ou serviço. Verifique a conexão e tente novamente.'
      setErrorAndView(friendly)
    }
  }

  const statusTone = useMemo(() => result?.status === 'success' ? 'ok' : 'warn', [result])
  const qualityEntries = result ? (Object.entries(result.qualitySignals) as Array<[keyof QualitySignals, QualitySignals[keyof QualitySignals]]>) : []

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: reduced ? 0 : .34, ease: [0.22, 1, 0.36, 1] }}>
      <main className="app-shell">
        <div className="oven-glow" aria-hidden="true" />
        <header className="topbar">
          <div><strong>LA BRACIERA</strong><span>VISION</span></div>
          <div className="live-pill"><span className={canLive ? 'dot on' : 'dot'} />{canLive ? 'LIVE pronto' : 'API pendente'}</div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.section key="home" className="screen home" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Sparkles size={15}/> Visão computacional aplicada à excelência</motion.div>
              <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }}>Do forno ao padrão.<br/><em>Em uma foto.</em></motion.h1>
              <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : .08 }}>Reconheça pizzas do catálogo controlado e visualize sinais preliminares de qualidade — sem transformar incerteza em resposta falsa.</motion.p>
              <div className="action-stack">
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> Tirar foto</motion.button>
                <motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><Upload/> Anexar da galeria</motion.button>
              </div>
              <div className="mode-grid">
                <div className="mode-card"><span>LIVE</span><b>Câmera ou upload real</b><small>{canLive ? 'Conectado à API HTTPS.' : 'Disponível assim que VITE_API_BASE_URL for configurada.'}</small></div>
                <div className="mode-card"><span>CATÁLOGO</span><b>36 pizzas conhecidas</b><small>Baixa evidência ou ambiguidade continuam retornando inconclusive.</small></div>
              </div>
              {!canSafeDemo && <p className="truth-note"><ShieldCheck size={16}/> A demo segura continua bloqueada até existirem fotos reais pré-validadas pela mesma API.</p>}
            </motion.section>
          )}

          {view === 'camera' && (
            <motion.section key="camera" className="screen camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="camera-frame">
                <video ref={videoRef} playsInline muted className="camera-video" onCanPlay={() => setCameraReady(true)} />
                <div className={cameraReady ? 'pizza-guide ready' : 'pizza-guide'} aria-hidden="true" />
                <AnimatePresence>{captureFlash && <motion.div className="capture-flash" initial={{ opacity: .8 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} />}</AnimatePresence>
                {cameraError && <div className="camera-message"><XCircle/><p>{cameraError}</p></div>}
              </div>
              <p className="camera-tip">Enquadre a pizza inteira e deixe uma pequena margem ao redor.</p>
              <div className="camera-controls">
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={() => fileRef.current?.click()} aria-label="Abrir galeria"><ImageIcon/></motion.button>
                <motion.button className="shutter" whileTap={reduced ? undefined : { scale: .9 }} onClick={capture} aria-label="Capturar foto" disabled={!!cameraError || !cameraReady}><span/></motion.button>
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={reset} aria-label="Fechar câmera"><XCircle/></motion.button>
              </div>
            </motion.section>
          )}

          {view === 'preview' && preview && (
            <motion.section key="preview" className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">PREVIEW</div>
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Foto selecionada da pizza" />
              <h2>Boa foto?</h2><p>Confirme para iniciar a análise. A imagem já foi orientada e reduzida antes do envio.</p>
              <div className="action-stack"><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={analyze}><Sparkles/> Analisar pizza</motion.button><motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Refazer</motion.button></div>
            </motion.section>
          )}

          {view === 'analyzing' && preview && (
            <motion.section key="analyzing" className="screen analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="section-label">ANÁLISE EM CURSO</div>
              <div className="scan-wrap"><motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza em análise"/><div className="scan-line" /></div>
              <div className="stage-list">{stages.map((s, i) => <motion.div key={s} className={i <= stage ? 'stage active' : 'stage'} initial={{ opacity: .55, x: reduced ? 0 : -4 }} animate={{ opacity: i <= stage ? 1 : .55, x: 0 }}>{i < stage ? <CheckCircle2/> : <span className="stage-dot"/>}<span>{s}</span></motion.div>)}</div>
              <small className="latency-note">Os estágios são feedback de interface; a conclusão só aparece após resposta real da API.</small>
            </motion.section>
          )}

          {view === 'result' && result && preview && (
            <motion.section key="result" className="screen result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza analisada"/>
              <div className={`result-status ${statusTone}`}>{result.status === 'success' ? 'Reconhecimento' : 'Decisão segura'}</div>
              <motion.h2 initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}>{result.status === 'success' ? result.pizzaName : 'Não tenho confiança suficiente'}</motion.h2>
              <p className="confidence">{confidenceText(result)}</p>
              {result.status === 'inconclusive' && <p>Esta foto não oferece evidência suficiente para escolher uma pizza do catálogo com segurança.</p>}
              {result.ingredients.length > 0 && <div className="panel"><h3>Ingredientes do catálogo</h3><div className="chips">{result.ingredients.map((x, index) => <motion.span key={x} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .035 * index }}>{x}</motion.span>)}</div></div>}
              {result.referenceImage && <motion.figure className="reference-card" layoutId="official-reference" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}><img src={result.referenceImage} alt={`Referência oficial de ${result.pizzaName || 'pizza La Braciera'}`} loading="lazy"/><figcaption><span>Referência oficial</span><strong>{result.pizzaName || 'La Braciera'}</strong><small>Imagem verificada do catálogo usada como contexto visual.</small></figcaption></motion.figure>}
              {qualityEntries.length > 0 && <div className="panel"><h3>Prévia de padrão visual</h3><p className="panel-caption">Sinais experimentais; não são critérios oficiais de QA da La Braciera.</p>{qualityEntries.map(([key,q], index) => <motion.div className="quality" key={key} initial={{ opacity: 0, x: reduced ? 0 : -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : .07 * index }}><i className={q.state}/><div><b>{qualityLabels[key]}</b><small>{q.observation}</small></div></motion.div>)}</div>}
              {result.alternatives.length > 0 && <details className="panel"><summary>Alternativas <ChevronDown size={18}/></summary>{result.alternatives.map(a => <div className="alternative" key={a.pizzaId}><span>{a.pizzaName}</span><small>{a.confidenceScore == null ? 'não calibrado' : `${Math.round(a.confidenceScore * 100)}%`}</small></div>)}</details>}
              {result.warnings.length > 0 && <div className="warning-box">{result.warnings.join(' ')}</div>}
              <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Nova análise</motion.button>
            </motion.section>
          )}

          {view === 'error' && (
            <motion.section key="error" className="screen error-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <XCircle size={42}/><div className="section-label">ERRO REAL</div><h2>A análise não foi concluída.</h2><p>{error}</p><p className="truth-note">Nenhum fallback de pizza foi exibido.</p><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Tentar novamente</motion.button>
            </motion.section>
          )}
        </AnimatePresence>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile}/>
        <footer>Powered by <strong>LightPath</strong> · Protótipo comercial</footer>
      </main>
    </MotionConfig>
  )
}
