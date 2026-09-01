import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Camera, CheckCircle2, ChevronDown, Image as ImageIcon, RotateCcw, ShieldCheck, Sparkles, Upload, XCircle } from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { analyzePizza, apiConfigured } from './lib/api'
import { canvasCapture, normalizeImage } from './lib/image'
import { DEMO_SAMPLES } from './demo'
import type { AnalysisResult } from './types'

type View = 'home' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'

const stages = ['Lendo formato', 'Comparando com o cardápio', 'Avaliando padrão visual']
const springResult = { type: 'spring', stiffness: 245, damping: 24, mass: .82 } as const
const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: .065, delayChildren: .04 } } } as const
const staggerItem = { hidden: { opacity: 0, y: 9 }, show: { opacity: 1, y: 0 } } as const

function confidenceText(result: AnalysisResult) {
  if (result.status === 'inconclusive') return 'Inconclusivo'
  if (result.confidenceScore != null) return `${Math.round(result.confidenceScore * 100)}% de confiança`
  const labels: Record<AnalysisResult['confidenceLabel'], string> = {
    high: 'Confiança alta',
    medium: 'Confiança média',
    low: 'Confiança baixa',
    unavailable: 'Confiança não calibrada',
  }
  return labels[result.confidenceLabel]
}

export default function App() {
  const reduced = useReducedMotion()
  const [view, setView] = useState<View>('home')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
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
    if (!video || !video.videoWidth) return
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
        : code.includes('429') || code === 'OPENAI_RATE_LIMIT' ? 'A IA está temporariamente ocupada. Tente novamente.'
        : code === 'OPENAI_ERROR' ? 'A análise de IA falhou. Nenhum resultado foi inventado.'
        : 'Falha de rede ou serviço. Verifique a conexão e tente novamente.'
      setErrorAndView(friendly)
    }
  }

  const statusTone = useMemo(() => result?.status === 'success' ? 'ok' : result?.status === 'inconclusive' ? 'warn' : 'bad', [result])

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: reduced ? 0 : .34, ease: [0.22, 1, 0.36, 1] }}>
      <main className="app-shell">
        <header className="topbar">
          <div><strong>LA BRACIERA</strong><span>VISION</span></div>
          <div className="live-pill"><span className={canLive ? 'dot on' : 'dot'} />{canLive ? 'Análise ativa' : 'API pendente'}</div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {view === 'home' && (
            <motion.section key="home" className="screen home" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -6 }}>
              <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : .05 }}><Sparkles size={15}/> Visão computacional aplicada à excelência</motion.div>
              <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .08 }}>Do forno ao padrão.<br/><em>Em uma foto.</em></motion.h1>
              <motion.p className="lead" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .14 }}>Reconheça pizzas do catálogo controlado e visualize sinais preliminares de qualidade — sem transformar incerteza em resposta falsa.</motion.p>
              <motion.div className="action-stack" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .2 }}>
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> Tirar foto</motion.button>
                <motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><Upload/> Anexar da galeria</motion.button>
              </motion.div>
              <div className="mode-grid">
                <div className="mode-card"><span>LIVE</span><b>Câmera ou upload real</b><small>{canLive ? 'Conectado à API remota.' : 'Disponível assim que VITE_API_BASE_URL for configurada.'}</small></div>
                <div className="mode-card"><span>DEMO SEGURA</span><b>Fotos reais pré-validadas</b><small>{canSafeDemo ? `${DEMO_SAMPLES.length} amostra(s) validada(s).` : 'Bloqueada até existirem imagens + resultados reais com proveniência.'}</small></div>
              </div>
              {!canSafeDemo && <p className="truth-note"><ShieldCheck size={16}/> A demo segura não usa fixtures inventadas. Ela permanece bloqueada até o conjunto pré-validado existir.</p>}
            </motion.section>
          )}

          {view === 'camera' && (
            <motion.section key="camera" className="camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="camera-frame">
                <video ref={videoRef} playsInline muted className="camera-video" />
                <div className="camera-shade" aria-hidden="true"/>
                <div className="pizza-guide" aria-hidden="true" />
                <div className="camera-guide-copy"><b>Enquadre a pizza inteira</b><span>Deixe uma pequena margem ao redor.</span></div>
                {cameraError && <div className="camera-message"><XCircle/><p>{cameraError}</p></div>}
              </div>
              <div className="camera-controls">
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .9 }} onClick={() => fileRef.current?.click()} aria-label="Abrir galeria"><ImageIcon/></motion.button>
                <motion.button className="shutter" whileTap={reduced ? undefined : { scale: .9 }} onClick={capture} aria-label="Capturar foto" disabled={!!cameraError}><span/></motion.button>
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .9 }} onClick={reset} aria-label="Fechar câmera"><XCircle/></motion.button>
              </div>
            </motion.section>
          )}

          {view === 'preview' && preview && (
            <motion.section key="preview" className="screen preview-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">FOTO PRONTA</div>
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Foto selecionada da pizza" />
              <h2>Esta imagem está boa?</h2><p>Prefira a pizza inteira no quadro e uma pequena margem ao redor.</p>
              <div className="action-stack"><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={analyze}><Sparkles/> Analisar pizza</motion.button><motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Refazer</motion.button></div>
            </motion.section>
          )}

          {view === 'analyzing' && preview && (
            <motion.section key="analyzing" className="screen analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="section-label">ANÁLISE EM CURSO</div>
              <div className="scan-wrap"><motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza em análise"/><div className="scan-line" /></div>
              <div className="stage-list">{stages.map((s, i) => <motion.div key={s} className={i <= stage ? 'stage active' : 'stage'} animate={{ opacity: i <= stage ? 1 : .36, x: i <= stage && !reduced ? 2 : 0 }} transition={{ duration: .22 }}>{i < stage ? <CheckCircle2/> : <span className="stage-dot"/>}<span>{s}</span></motion.div>)}</div>
              <small className="latency-note">Os estágios são feedback de interface; a conclusão só aparece após resposta real da API.</small>
            </motion.section>
          )}

          {view === 'result' && result && preview && (
            <motion.section key="result" className="screen result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza analisada"/>
              <motion.div className={`result-status ${statusTone}`} initial={{ opacity: 0, scale: reduced ? 1 : .96 }} animate={{ opacity: 1, scale: 1 }} transition={springResult}>{result.status === 'success' ? 'Reconhecimento' : 'Decisão segura'}</motion.div>
              <motion.h2 initial={{ opacity: 0, y: reduced ? 0 : 11, scale: reduced ? 1 : .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={springResult}>{result.status === 'success' ? result.pizzaName : 'Não tenho confiança suficiente'}</motion.h2>
              <motion.p className="confidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : .08 }}>{confidenceText(result)}</motion.p>
              {result.status === 'inconclusive' && <p>Esta foto não oferece evidência suficiente para escolher uma pizza do catálogo com segurança.</p>}
              {result.ingredients.length > 0 && <motion.div className="panel" variants={staggerContainer} initial="hidden" animate="show"><h3>Ingredientes do catálogo</h3><div className="chips">{result.ingredients.map(x => <motion.span variants={staggerItem} key={x}>{x}</motion.span>)}</div></motion.div>}
              {result.referenceImage && <motion.div className="panel reference-panel" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .1 }}><div className="panel-heading"><h3>Referência oficial</h3><span>cardápio</span></div><motion.img layoutId={`reference-${result.pizzaId ?? 'pizza'}`} src={result.referenceImage} alt={`Referência oficial de ${result.pizzaName ?? 'pizza'}`}/></motion.div>}
              {result.qualitySignals.length > 0 && <div className="panel"><h3>Prévia de padrão visual</h3><p className="panel-caption">Sinais experimentais; não são critérios oficiais de QA da La Braciera.</p>{result.qualitySignals.map((q, i) => <motion.div className="quality" key={q.label} initial={{ opacity: 0, x: reduced ? 0 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : .07 * i }}><i className={q.state}/><div><b>{q.label}</b><small>{q.detail}</small></div></motion.div>)}</div>}
              {result.alternatives.length > 0 && <details className="panel"><summary>Alternativas <ChevronDown size={18}/></summary>{result.alternatives.map(a => <div className="alternative" key={a.pizzaId}><span>{a.pizzaName}</span><small>{a.confidenceScore == null ? '—' : `${Math.round(a.confidenceScore * 100)}%`}</small></div>)}</details>}
              {result.warnings.length > 0 && <div className="warning-box">{result.warnings.join(' ')}</div>}
              <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Nova análise</motion.button>
            </motion.section>
          )}

          {view === 'error' && (
            <motion.section key="error" className="screen error-screen" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="assertive">
              <XCircle size={42}/><div className="section-label">ERRO REAL</div><h2>A análise não foi concluída.</h2><p>{error}</p><p className="truth-note">Nenhum fallback de pizza foi exibido.</p><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Tentar novamente</motion.button>
            </motion.section>
          )}
        </AnimatePresence>

        <input ref={fileRef} type="file" accept="image/*" capture={undefined} hidden onChange={onFile}/>
        <footer>Powered by <strong>LightPath</strong> · Protótipo comercial</footer>
      </main>
    </MotionConfig>
  )
}
