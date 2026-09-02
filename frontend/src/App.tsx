import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Camera, CheckCircle2, ChevronDown, Image as ImageIcon, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Upload, XCircle } from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzePizza, apiConfigured } from './lib/api'
import { assessCapturePair, sampleVideoFrame, type CaptureIssue } from './lib/camera'
import { canvasCapture, normalizeImage } from './lib/image'
import { DEMO_SAMPLES } from './demo'
import type { AnalysisResult, QualitySignals } from './types'

type View = 'home' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'
type FacingMode = 'environment' | 'user'

const stages = ['Lendo formato', 'Comparando com o cardápio', 'Avaliando padrão visual']
const qualityLabels: Record<keyof QualitySignals, string> = {
  shape: 'Formato / circularidade',
  bake: 'Assamento visual',
  crust: 'Borda / cornicione',
  toppingDistribution: 'Distribuição de ingredientes',
  expectedIngredients: 'Ingredientes esperados visíveis'
}

const captureIssueCopy: Record<CaptureIssue, string> = {
  low_resolution: 'A câmera está com resolução baixa. Tente alternar a câmera ou use uma foto da galeria.',
  low_light: 'Está escuro demais. Aproxime-se de uma luz uniforme e evite sombras fortes sobre a pizza.',
  overexposed: 'A luz está estourando a imagem. Afaste a fonte de luz ou mude levemente o ângulo.',
  motion: 'A câmera se moveu. Segure firme por um instante e fotografe novamente.',
  low_detail: 'A imagem parece sem detalhe suficiente. Limpe a lente, aproxime um pouco e toque para focar se o aparelho permitir.'
}

function confidenceText(result: AnalysisResult) {
  if (result.status === 'inconclusive') return 'Inconclusivo'
  if (!result.confidenceCalibrated || result.confidenceScore == null) {
    const labels = { high: 'Confiança visual alta', medium: 'Confiança visual média', low: 'Confiança visual baixa', unavailable: 'Confiança indisponível' }
    return labels[result.confidenceLabel]
  }
  return `${Math.round(result.confidenceScore * 100)}% de confiança`
}

function cameraErrorText(error: unknown) {
  if (!(error instanceof DOMException)) return 'Não foi possível acessar a câmera. Tente novamente ou use a galeria.'
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador ou use a galeria.'
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'Nenhuma câmera foi encontrada neste dispositivo. Você ainda pode anexar uma foto.'
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'A câmera está sendo usada por outro app ou não pôde iniciar. Feche outros apps e tente novamente.'
  if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') return 'Esta câmera não suporta a configuração solicitada. Tente novamente ou alterne a câmera.'
  if (error.name === 'SecurityError') return 'O navegador bloqueou a câmera. Confirme que a página está em HTTPS.'
  return 'Não foi possível acessar a câmera. Tente novamente ou use a galeria.'
}

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds))

export default function App() {
  const reduced = useReducedMotion()
  const [view, setView] = useState<View>('home')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraHint, setCameraHint] = useState('Centralize a pizza inteira dentro do guia.')
  const [cameraHintWarning, setCameraHintWarning] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [captureFlash, setCaptureFlash] = useState(false)
  const [stage, setStage] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const canLive = apiConfigured()
  const canSafeDemo = DEMO_SAMPLES.length > 0

  const stopCameraTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const cleanupCamera = useCallback(() => {
    stopCameraTracks()
    setCameraReady(false)
    setCameraBusy(false)
  }, [stopCameraTracks])

  useEffect(() => () => {
    stopCameraTracks()
    controllerRef.current?.abort()
  }, [stopCameraTracks])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    if (view !== 'analyzing') return
    const timer = window.setInterval(() => setStage(s => Math.min(2, s + 1)), 1500)
    return () => window.clearInterval(timer)
  }, [view])

  const startCamera = useCallback(async (mode: FacingMode) => {
    setView('camera')
    setCameraError('')
    setCameraReady(false)
    setCameraBusy(true)
    setCameraHintWarning(false)
    setCameraHint('Preparando a câmera…')
    stopCameraTracks()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não disponível neste navegador. Use a galeria para continuar.')
      setCameraBusy(false)
      return
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        })
      } catch (firstError) {
        if (firstError instanceof DOMException && (firstError.name === 'OverconstrainedError' || firstError.name === 'NotFoundError')) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        } else {
          throw firstError
        }
      }

      streamRef.current = stream
      requestAnimationFrame(() => {
        const video = videoRef.current
        if (!video || streamRef.current !== stream) return
        video.srcObject = stream
        void video.play().catch(() => undefined)
      })
    } catch (cameraAccessError) {
      setCameraError(cameraErrorText(cameraAccessError))
      setCameraBusy(false)
      setCameraHintWarning(true)
    }
  }, [stopCameraTracks])

  function openCamera() {
    setFacingMode('environment')
    void startCamera('environment')
  }

  function retryCamera() {
    void startCamera(facingMode)
  }

  function switchCamera() {
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    void startCamera(next)
  }

  function onCameraCanPlay() {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    setCameraReady(true)
    setCameraBusy(false)
    setCameraHintWarning(false)
    setCameraHint('Pizza inteira no guia · câmera paralela à mesa · segure firme.')
  }

  function setNormalized(next: File) {
    cleanupCamera()
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setResult(null)
    setCameraHintWarning(false)
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
    if (!video || !cameraReady || cameraBusy || !video.videoWidth) return

    setCameraBusy(true)
    setCameraHintWarning(false)
    setCameraHint('Segure firme… verificando a captura.')

    try {
      const before = sampleVideoFrame(video)
      await wait(220)
      const after = sampleVideoFrame(video)

      if (before && after) {
        const assessment = assessCapturePair(before, after)
        if (!assessment.ok && assessment.issue) {
          setCameraHint(captureIssueCopy[assessment.issue])
          setCameraHintWarning(true)
          setCameraBusy(false)
          return
        }
      }

      setCaptureFlash(true)
      await wait(70)
      setNormalized(await canvasCapture(video))
    } catch {
      setCameraBusy(false)
      setCameraHintWarning(true)
      setCameraHint('A captura falhou. Tente novamente ou use a galeria.')
    } finally {
      setCaptureFlash(false)
    }
  }

  function reset() {
    controllerRef.current?.abort()
    cleanupCamera()
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
    setResult(null)
    setError('')
    setStage(0)
    setCameraError('')
    setCameraHintWarning(false)
    setView('home')
  }

  function setErrorAndView(message: string) {
    cleanupCamera()
    setError(message)
    setView('error')
  }

  async function analyze() {
    if (!file) return
    if (!canLive) return setErrorAndView('A API ainda não está disponível neste deploy.')
    setStage(0)
    setView('analyzing')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const data = await analyzePizza(file, controller.signal)
      setResult(data)
      setView('result')
    } catch (analysisError) {
      if (controller.signal.aborted) return
      const code = analysisError instanceof Error ? analysisError.message : 'UNKNOWN_ERROR'
      const friendly = code === 'openai_rate_limited' || code === 'rate_limited' ? 'A IA está temporariamente ocupada. Tente novamente.'
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
          <div className="brand-lockup"><strong>LA BRACIERA</strong><span>VISION</span></div>
          <div className="live-pill"><span className={canLive ? 'dot on' : 'dot'} />{canLive ? 'LIVE' : 'OFFLINE'}</div>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.section key="home" className="screen home" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Sparkles size={15}/> Visão computacional para uma pizza mais consistente</motion.div>
              <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }}>Do forno ao padrão.<br/><em>Em uma foto.</em></motion.h1>
              <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : .08 }}>Fotografe a pizza inteira. O Braciera Vision compara sinais visuais com o cardápio e prefere dizer “inconclusivo” a inventar uma resposta.</motion.p>
              <div className="action-stack">
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> Abrir câmera</motion.button>
                <motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><Upload/> Anexar da galeria</motion.button>
              </div>
              <div className="mode-grid">
                <div className="mode-card"><span>CAPTURA GUIADA</span><b>Menos tremor e corte</b><small>Guia de enquadramento + verificação leve de movimento, luz e detalhe antes da foto.</small></div>
                <div className="mode-card"><span>DECISÃO SEGURA</span><b>Reconhecer ou abstém</b><small>Foto ruim, produto fora do domínio ou baixa evidência podem retornar inconclusive.</small></div>
              </div>
              {!canSafeDemo && <p className="truth-note"><ShieldCheck size={16}/> A demo segura permanece bloqueada até existir um conjunto real pré-validado pela mesma API.</p>}
            </motion.section>
          )}

          {view === 'camera' && (
            <motion.section key="camera" className="screen camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Captura de pizza">
              <div className="camera-frame">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onCanPlay={onCameraCanPlay}
                  className="camera-video"
                />

                <div className={cameraReady ? 'pizza-guide ready' : 'pizza-guide'} aria-hidden="true">
                  <span className="guide-center" />
                </div>
                <div className="camera-shade" aria-hidden="true" />
                <AnimatePresence>{captureFlash && <motion.div className="capture-flash" initial={{ opacity: .82 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} />}</AnimatePresence>

                <div className="camera-top-actions">
                  <motion.button className="camera-top-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={switchCamera} disabled={cameraBusy} aria-label="Alternar câmera" title="Alternar câmera"><RefreshCw/></motion.button>
                  <motion.button className="camera-top-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={reset} aria-label="Fechar câmera" title="Fechar câmera"><XCircle/></motion.button>
                </div>

                {!cameraReady && !cameraError && (
                  <div className="camera-loading" role="status" aria-live="polite"><span className="camera-spinner"/><p>Preparando câmera…</p></div>
                )}

                {cameraError && (
                  <div className="camera-message" role="alert">
                    <Camera size={32}/>
                    <p>{cameraError}</p>
                    <button className="camera-retry" onClick={retryCamera}><RefreshCw size={16}/> Tentar novamente</button>
                  </div>
                )}

                <div className="camera-guide-copy">
                  <span>{facingMode === 'environment' ? 'CÂMERA TRASEIRA' : 'CÂMERA FRONTAL'}</span>
                  <strong>Pizza inteira dentro do círculo</strong>
                </div>
              </div>

              <div className={cameraHintWarning ? 'capture-coach warning' : 'capture-coach'} aria-live="polite">
                <p>{cameraHint}</p>
                <div className="capture-rules" aria-label="Dicas para a foto"><span>pizza inteira</span><span>ângulo quase paralelo</span><span>luz uniforme</span></div>
              </div>

              <div className="camera-controls">
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={() => fileRef.current?.click()} aria-label="Abrir galeria" disabled={cameraBusy}><ImageIcon/></motion.button>
                <motion.button className="shutter" whileTap={reduced ? undefined : { scale: .9 }} onClick={capture} aria-label="Capturar foto" disabled={!!cameraError || !cameraReady || cameraBusy}><span/></motion.button>
                <div className="camera-control-label" aria-hidden="true">{cameraBusy ? 'segure firme' : cameraReady ? 'fotografar' : 'aguarde'}</div>
              </div>
            </motion.section>
          )}

          {view === 'preview' && preview && (
            <motion.section key="preview" className="screen preview-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">FOTO PRONTA</div>
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Foto selecionada da pizza" />
              <h2>Esta imagem está boa?</h2>
              <p>Idealmente a pizza deve aparecer inteira, nítida e com pouca perspectiva. A imagem já foi orientada e reduzida antes do envio.</p>
              <div className="action-stack"><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={analyze}><Sparkles/> Analisar pizza</motion.button><motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><RotateCcw/> Tirar novamente</motion.button></div>
            </motion.section>
          )}

          {view === 'analyzing' && preview && (
            <motion.section key="analyzing" className="screen analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="section-label">ANÁLISE EM CURSO</div>
              <div className="scan-wrap"><motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza em análise"/><div className="scan-line" /></div>
              <div className="stage-list">{stages.map((stageName, index) => <motion.div key={stageName} className={index <= stage ? 'stage active' : 'stage'} initial={{ opacity: .55, x: reduced ? 0 : -4 }} animate={{ opacity: index <= stage ? 1 : .55, x: 0 }}>{index < stage ? <CheckCircle2/> : <span className="stage-dot"/>}<span>{stageName}</span></motion.div>)}</div>
              <small className="latency-note">Os estágios são feedback de interface. O resultado só aparece após resposta real da API.</small>
            </motion.section>
          )}

          {view === 'result' && result && preview && (
            <motion.section key="result" className="screen result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza analisada"/>
              <motion.div className={`result-status ${statusTone}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{result.status === 'success' ? 'Reconhecimento' : 'Decisão segura'}</motion.div>
              <motion.h2 initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}>{result.status === 'success' ? result.pizzaName : 'Não tenho confiança suficiente'}</motion.h2>
              <p className="confidence">{confidenceText(result)}</p>
              {result.status === 'inconclusive' && <p>Esta foto não oferece evidência suficiente para escolher um item com segurança. Uma nova foto mais inteira, estável e próxima do topo costuma ajudar.</p>}
              {result.ingredients.length > 0 && <div className="panel"><h3>Ingredientes do catálogo</h3><div className="chips">{result.ingredients.map((ingredient, index) => <motion.span key={ingredient} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .035 * index }}>{ingredient}</motion.span>)}</div></div>}
              {result.referenceImage && <motion.figure className="reference-card" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}><img src={result.referenceImage} alt={`Referência oficial de ${result.pizzaName || 'item La Braciera'}`} loading="lazy"/><figcaption><span>REFERÊNCIA OFICIAL</span><strong>{result.pizzaName || 'La Braciera'}</strong><small>Imagem verificada do catálogo usada como contexto visual, não como padrão oficial de QA.</small></figcaption></motion.figure>}
              {qualityEntries.length > 0 && <div className="panel"><h3>Prévia de padrão visual</h3><p className="panel-caption">Sinais experimentais; não são critérios oficiais de QA da La Braciera.</p>{qualityEntries.map(([key, quality], index) => <motion.div className="quality" key={key} initial={{ opacity: 0, x: reduced ? 0 : -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : .08 * index }}><i className={quality.state}/><div><b>{qualityLabels[key]}</b><small>{quality.observation}</small></div></motion.div>)}</div>}
              {result.alternatives.length > 0 && <details className="panel"><summary>Alternativas <ChevronDown size={18}/></summary>{result.alternatives.map(alternative => <div className="alternative" key={alternative.pizzaId}><span>{alternative.pizzaName}</span><small>{alternative.confidenceScore == null ? 'não calibrado' : `${Math.round(alternative.confidenceScore * 100)}%`}</small></div>)}</details>}
              {result.warnings.length > 0 && <div className="warning-box">{result.warnings.join(' ')}</div>}
              <div className="action-stack result-actions">
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> {result.status === 'inconclusive' ? 'Tirar outra foto' : 'Nova análise'}</motion.button>
                <motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><ImageIcon/> Usar galeria</motion.button>
              </div>
            </motion.section>
          )}

          {view === 'error' && (
            <motion.section key="error" className="screen error-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="assertive">
              <XCircle size={42}/><div className="section-label">NÃO CONCLUÍDO</div><h2>A análise foi interrompida.</h2><p>{error}</p><p className="truth-note">Nenhum fallback de pizza foi exibido.</p><div className="action-stack"><motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> Tentar com outra foto</motion.button><motion.button className="secondary" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><ImageIcon/> Abrir galeria</motion.button></div>
            </motion.section>
          )}
        </AnimatePresence>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile}/>
        <footer>Powered by <strong>LightPath</strong> · Protótipo comercial</footer>
      </main>
    </MotionConfig>
  )
}
