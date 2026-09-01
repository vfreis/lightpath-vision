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
        <header className="topbar">
          <div><strong>LA BRACIERA</strong><span>VISION</span></div>
          <div className="live-pill"><span className={canLive ? 'dot on' : 'dot'} />{canLive ? 'LIVE pronto' : 'API pendente'}</div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.section key="home" className="screen home" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="eyebrow"><Sparkles size={15}/> Visão computacional aplicada à excelência</div>
              <h1>Do forno ao padrão.<br/><em>Em uma foto.</em></h1>
              <p className="lead">Reconheça pizzas do catálogo controlado e visualize sinais preliminares de qualidade — sem transformar incerteza em resposta falsa.</p>
              <div className="action-stack">
                <button className="primary" onClick={openCamera}><Camera/> Tirar foto</button>
                <button className="secondary" onClick={() => fileRef.current?.click()}><Upload/> Anexar da galeria</button>
              </div>
              <div className="mode-grid">
                <div className="mode-card"><span>LIVE</span><b>Câmera ou upload real</b><small>{canLive ? 'Conectado à API remota.' : 'Disponível assim que VITE_API_BASE_URL for configurada.'}</small></div>
                <div className="mode-card"><span>DEMO SEGURA</span><b>Fotos reais pré-validadas</b><small>{canSafeDemo ? `${DEMO_SAMPLES.length} amostra(s) validada(s).` : 'Bloqueada até existirem imagens + resultados reais com proveniência.'}</small></div>
              </div>
              {!canSafeDemo && <p className="truth-note"><ShieldCheck size={16}/> A demo segura não usa fixtures inventadas. Ela permanece bloqueada até o conjunto pré-validado existir.</p>}
            </motion.section>
          )}

          {view === 'camera' && (
            <motion.section key="camera" className="screen camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="camera-frame">
                <video ref={videoRef} playsInline muted className="camera-video" />
                <div className="pizza-guide" aria-hidden="true" />
                {cameraError && <div className="camera-message"><XCircle/><p>{cameraError}</p></div>}
              </div>
              <p className="camera-tip">Enquadre a pizza inteira e deixe uma pequena margem ao redor.</p>
              <div className="camera-controls">
                <button className="icon-action" onClick={() => fileRef.current?.click()} aria-label="Abrir galeria"><ImageIcon/></button>
                <button className="shutter" onClick={capture} aria-label="Capturar foto" disabled={!!cameraError}><span/></button>
                <button className="icon-action" onClick={reset} aria-label="Fechar câmera"><XCircle/></button>
              </div>
            </motion.section>
          )}

          {view === 'preview' && preview && (
            <motion.section key="preview" className="screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">PREVIEW</div>
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Foto selecionada da pizza" />
              <h2>Boa foto?</h2><p>Confirme para iniciar a análise. A imagem já foi orientada e reduzida antes do envio.</p>
              <div className="action-stack"><button className="primary" onClick={analyze}><Sparkles/> Analisar pizza</button><button className="secondary" onClick={reset}><RotateCcw/> Refazer</button></div>
            </motion.section>
          )}

          {view === 'analyzing' && preview && (
            <motion.section key="analyzing" className="screen analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">ANÁLISE EM CURSO</div>
              <div className="scan-wrap"><motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza em análise"/><div className="scan-line" /></div>
              <div className="stage-list">{stages.map((s, i) => <div key={s} className={i <= stage ? 'stage active' : 'stage'}>{i < stage ? <CheckCircle2/> : <span className="stage-dot"/>}<span>{s}</span></div>)}</div>
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
              {result.ingredients.length > 0 && <div className="panel"><h3>Ingredientes do catálogo</h3><div className="chips">{result.ingredients.map(x => <span key={x}>{x}</span>)}</div></div>}
              {qualityEntries.length > 0 && <div className="panel"><h3>Prévia de padrão visual</h3><p className="panel-caption">Sinais experimentais; não são critérios oficiais de QA da La Braciera.</p>{qualityEntries.map(([key,q]) => <div className="quality" key={key}><i className={q.state}/><div><b>{qualityLabels[key]}</b><small>{q.observation}</small></div></div>)}</div>}
              {result.alternatives.length > 0 && <details className="panel"><summary>Alternativas <ChevronDown size={18}/></summary>{result.alternatives.map(a => <div className="alternative" key={a.pizzaId}><span>{a.pizzaName}</span><small>{a.confidenceScore == null ? 'não calibrado' : `${Math.round(a.confidenceScore * 100)}%`}</small></div>)}</details>}
              {result.warnings.length > 0 && <div className="warning-box">{result.warnings.join(' ')}</div>}
              <button className="primary" onClick={reset}><RotateCcw/> Nova análise</button>
            </motion.section>
          )}

          {view === 'error' && (
            <motion.section key="error" className="screen error-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <XCircle size={42}/><div className="section-label">ERRO REAL</div><h2>A análise não foi concluída.</h2><p>{error}</p><p className="truth-note">Nenhum fallback de pizza foi exibido.</p><button className="primary" onClick={reset}><RotateCcw/> Tentar novamente</button>
            </motion.section>
          )}
        </AnimatePresence>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile}/>
        <footer>Powered by <strong>LightPath</strong> · Protótipo comercial</footer>
      </main>
    </MotionConfig>
  )
}
