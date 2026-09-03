import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Camera, ChevronDown, Image as ImageIcon, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Upload, XCircle } from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzePizza, apiConfigured } from './lib/api'
import { assessCapturePair, sampleVideoFrame, type CaptureIssue } from './lib/camera'
import { canvasCapture, normalizeImage } from './lib/image'
import type { AnalysisResult, QualitySignal, QualitySignals } from './types'

type View = 'home' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'
type FacingMode = 'environment' | 'user'

type BenchReading = {
  label: string
  signal?: QualitySignal
  fallback: string
}

const stages = [
  'Lendo o cornicione…',
  'Conferindo o ponto de forno…',
  'Mapeando a montagem…',
  'Cruzando ingredientes visuais…',
  'Comparando com a referência da casa…',
  'Fechando a leitura…'
]

const captureIssueCopy: Record<CaptureIssue, string> = {
  low_resolution: 'Foto fora do ponto — resolução baixa. Alterne a câmera ou use uma foto da galeria.',
  low_light: 'Foto fora do ponto — está escuro. Procure luz uniforme sobre toda a pizza.',
  overexposed: 'Foto fora do ponto — a luz estourou a imagem. Reduza o reflexo ou mude levemente o ângulo.',
  motion: 'Foto fora do ponto — houve movimento. Segure firme por um instante e tente novamente.',
  low_detail: 'Foto fora do ponto — faltou detalhe. Limpe a lente e aproxime um pouco sem cortar o cornicione.'
}

function cameraErrorText(error: unknown) {
  if (!(error instanceof DOMException)) return 'Não foi possível acessar a câmera. Tente novamente ou use a galeria.'
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador ou use a galeria.'
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'Nenhuma câmera foi encontrada neste dispositivo. Você ainda pode usar uma foto da galeria.'
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'A câmera está ocupada por outro app ou não pôde iniciar. Feche outros apps e tente novamente.'
  if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') return 'Esta câmera não suporta a configuração solicitada. Tente novamente ou alterne a câmera.'
  if (error.name === 'SecurityError') return 'O navegador bloqueou a câmera. Confirme que a página está em HTTPS.'
  return 'Não foi possível acessar a câmera. Tente novamente ou use a galeria.'
}

function recognitionText(result: AnalysisResult) {
  if (result.status === 'inconclusive') return 'Leitura inconclusiva'
  if (!result.confidenceCalibrated || result.confidenceScore == null) {
    const labels = {
      high: 'Reconhecimento visual forte na POC',
      medium: 'Reconhecimento visual moderado na POC',
      low: 'Reconhecimento visual fraco na POC',
      unavailable: 'Reconhecimento sem calibração numérica'
    }
    return labels[result.confidenceLabel]
  }
  return `${Math.round(result.confidenceScore * 100)}% de confiança calibrada`
}

function qualityStateLabel(signal?: QualitySignal) {
  if (!signal || signal.state === 'unknown') return 'Sem leitura suficiente'
  if (signal.state === 'attention') return 'Pede atenção visual'
  if (signal.state === 'positive') return 'Sem desvio evidente na imagem'
  return 'Leitura visual disponível'
}

function buildBenchReadings(result: AnalysisResult): BenchReading[] {
  const signals: QualitySignals = result.qualitySignals
  return [
    { label: 'Cornicione', signal: signals.crust, fallback: 'Leitura do cornicione ainda não disponível.' },
    { label: 'Ponto de forno', signal: signals.bake, fallback: 'Leitura do forno ainda não disponível.' },
    { label: 'Montagem', signal: signals.expectedIngredients, fallback: 'A montagem precisa de mais evidência visual.' },
    { label: 'Distribuição da cobertura', signal: signals.toppingDistribution, fallback: 'A distribuição da cobertura ainda não foi lida.' },
    {
      label: 'Similaridade com referência',
      fallback: result.referenceImage
        ? 'Referência da casa disponível para comparação; qualidade operacional ainda não calibrada.'
        : 'Ainda não há referência da casa disponível para esta leitura.'
    }
  ]
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
  const [cameraHint, setCameraHint] = useState('Deixe o cornicione e toda a montagem visíveis.')
  const [cameraHintWarning, setCameraHintWarning] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [captureFlash, setCaptureFlash] = useState(false)
  const [stage, setStage] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const canLive = apiConfigured()

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
    const timer = window.setInterval(() => setStage(current => Math.min(stages.length - 1, current + 1)), 1050)
    return () => window.clearInterval(timer)
  }, [view])

  const startCamera = useCallback(async (mode: FacingMode) => {
    setView('camera')
    setCameraError('')
    setCameraReady(false)
    setCameraBusy(true)
    setCameraHintWarning(false)
    setCameraHint('Preparando a bancada…')
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
    setCameraHint('Câmera pronta · pizza inteira · cornicione visível · pouca inclinação.')
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
    setCameraHint('Segure firme… conferindo o ponto da foto.')

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

  function clearAnalysis() {
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
  }

  function reset() {
    clearAnalysis()
    setView('home')
  }

  function retake() {
    clearAnalysis()
    void startCamera(facingMode)
  }

  function setErrorAndView(message: string) {
    cleanupCamera()
    setError(message)
    setView('error')
  }

  async function analyze() {
    if (!file) return
    if (!canLive) return setErrorAndView('A leitura ainda não está disponível neste deploy.')
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
      const friendly = code === 'openai_rate_limited' || code === 'rate_limited' ? 'A leitura está temporariamente ocupada. Tente novamente.'
        : code.startsWith('openai_') ? 'A análise não foi concluída. Nenhum produto ou padrão foi inventado.'
        : code === 'origin_not_allowed' ? 'Este endereço ainda não está autorizado pelo serviço de análise.'
        : code === 'invalid_image' || code === 'unsupported_image_type' ? 'A foto não pôde ser processada. Tente outra imagem.'
        : 'Falha de rede ou serviço. Verifique a conexão e tente novamente.'
      setErrorAndView(friendly)
    }
  }

  const qualityStatus = result?.quality_status ?? 'not_calibrated'
  const benchReadings = useMemo(() => result ? buildBenchReadings(result) : [], [result])

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: reduced ? 0 : .36, ease: [0.22, 1, 0.36, 1] }}>
      <main className="app-shell">
        <div className="oven-glow" aria-hidden="true" />
        <header className="topbar">
          <div className="brand-lockup"><strong>LA BRACIERA</strong><span>VISION</span></div>
          <span className="poc-stamp">POC LightPath · Em treinamento</span>
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.section key="home" className="screen home" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <motion.div className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>LA BRACIERA VISION</motion.div>
              <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }}>Da bancada ao<br/><em>padrão da casa.</em></motion.h1>
              <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : .08 }}>Fotografe uma pizza para reconhecer o produto e iniciar uma leitura visual de montagem, ponto de forno e referência da casa.</motion.p>

              <div className="action-stack">
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={openCamera}><Camera/> Conferir uma pizza</motion.button>
                <motion.button className="text-action" whileTap={reduced ? undefined : { scale: .985 }} onClick={() => fileRef.current?.click()}><Upload/> Usar foto da galeria</motion.button>
              </div>

              <div className="home-rule" aria-hidden="true" />
              <div className="house-copy">
                <span>O que esta POC começa a observar</span>
                <p>Cornicione · ponto de forno · montagem · distribuição da cobertura · referência da casa</p>
              </div>

              <details className="poc-disclosure">
                <summary><ShieldCheck size={15}/> Por que “em treinamento”? <ChevronDown size={16}/></summary>
                <p>Esta é uma prova de conceito da LightPath Tecnologia. Reconhecimento e leitura de qualidade ainda exigem fotos reais, treinamento, machine learning, calibração e regras da operação La Braciera. Não deve ser usada como controle operacional.</p>
              </details>
            </motion.section>
          )}

          {view === 'camera' && (
            <motion.section key="camera" className="screen camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label="Captura de pizza">
              <div className="camera-heading">
                <span>Conferência de bancada</span>
                <h2>Enquadre a pizza inteira</h2>
                <p>Deixe o cornicione e toda a montagem visíveis. Evite sombra forte, corte e inclinação excessiva.</p>
              </div>

              <div className="camera-frame">
                <video ref={videoRef} autoPlay playsInline muted onCanPlay={onCameraCanPlay} className="camera-video" />
                <div className={cameraReady ? 'pizza-guide ready' : 'pizza-guide'} aria-hidden="true"><span className="guide-center" /></div>
                <div className="camera-shade" aria-hidden="true" />
                <AnimatePresence>{captureFlash && <motion.div className="capture-flash" initial={{ opacity: .82 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} />}</AnimatePresence>

                <div className="camera-top-actions">
                  <motion.button className="camera-top-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={switchCamera} disabled={cameraBusy} aria-label="Alternar câmera" title="Alternar câmera"><RefreshCw/></motion.button>
                  <motion.button className="camera-top-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={reset} aria-label="Fechar câmera" title="Fechar câmera"><XCircle/></motion.button>
                </div>

                {cameraBusy && !cameraError && <div className="camera-loading" aria-live="polite"><span className="loader"/><p>{cameraReady ? 'Conferindo o ponto da foto…' : 'Preparando a bancada…'}</p></div>}
                {cameraError && <div className="camera-message"><XCircle/><p>{cameraError}</p><button className="camera-retry" onClick={retryCamera}><RefreshCw/> Tentar novamente</button></div>}
              </div>

              <p className={cameraHintWarning ? 'camera-tip warning' : 'camera-tip'} aria-live="polite">{cameraHint}</p>
              <div className="camera-controls">
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={() => fileRef.current?.click()} aria-label="Abrir galeria"><ImageIcon/><small>Galeria</small></motion.button>
                <motion.button className="shutter" whileTap={reduced ? undefined : { scale: .9 }} onClick={capture} aria-label="Capturar foto" disabled={!cameraReady || cameraBusy || !!cameraError}><span/></motion.button>
                <motion.button className="icon-action" whileTap={reduced ? undefined : { scale: .92 }} onClick={switchCamera} aria-label="Alternar câmera"><RefreshCw/><small>Virar</small></motion.button>
              </div>
            </motion.section>
          )}

          {view === 'preview' && preview && (
            <motion.section key="preview" className="screen preview-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="section-label">CONFERÊNCIA DA FOTO</div>
              <div className="photo-stage">
                <motion.img layoutId="pizza-photo" src={preview} className="photo-card" alt="Pizza selecionada para conferência" />
                <span className="photo-crust-guide" aria-hidden="true" />
              </div>
              <h2>Esta foto mostra o padrão?</h2>
              <p>Cornicione inteiro, montagem visível e pouca inclinação ajudam a comparar a pizza com a referência da casa.</p>
              <div className="action-stack">
                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={analyze}><Sparkles/> Usar esta foto</motion.button>
                <motion.button className="text-action" whileTap={reduced ? undefined : { scale: .985 }} onClick={retake}><RotateCcw/> Tirar novamente</motion.button>
              </div>
            </motion.section>
          )}

          {view === 'analyzing' && preview && (
            <motion.section key="analyzing" className="screen analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="section-label">LEITURA VISUAL DA POC</div>
              <div className="quality-visual">
                <motion.img layoutId="pizza-photo" src={preview} className="photo-card analysis-photo" alt="Pizza em leitura visual" />
                <motion.span className="crust-ring" aria-hidden="true" initial={{ opacity: 0, scale: reduced ? 1 : .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduced ? 0 : .18 }} />
                <span className="radial-read" aria-hidden="true" />
                <motion.span className="coverage-mark mark-a" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: stage >= 2 ? .8 : 0 }} />
                <motion.span className="coverage-mark mark-b" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: stage >= 2 ? .65 : 0 }} />
                <motion.span className="coverage-mark mark-c" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: stage >= 3 ? .72 : 0 }} />
              </div>

              <div className="reading-progress">
                <span>{String(stage + 1).padStart(2, '0')} / {String(stages.length).padStart(2, '0')}</span>
                <AnimatePresence mode="wait">
                  <motion.p key={stages[stage]} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }}>{stages[stage]}</motion.p>
                </AnimatePresence>
              </div>
              <small className="latency-note">Essas etapas contam a leitura da POC. A conclusão só aparece depois da resposta real do serviço de análise.</small>
            </motion.section>
          )}

          {view === 'result' && result && preview && (
            result.status === 'inconclusive' ? (
              <motion.section key="result-inconclusive" className="screen result editorial-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.img layoutId="pizza-photo" src={preview} className="photo-card result-photo" alt="Pizza analisada" />
                <span className="result-kicker">LEITURA INCONCLUSIVA</span>
                <h2>Essa pizza ainda pede outra olhada.</h2>
                <p>Não há evidência suficiente para cravar o produto ou o padrão. Tente uma foto com a pizza inteira, mais reta e com boa luz.</p>
                <div className="action-stack"><button className="primary" onClick={retake}><Camera/> Tirar outra foto</button><button className="text-action" onClick={() => fileRef.current?.click()}><Upload/> Usar foto da galeria</button></div>
              </motion.section>
            ) : (
              <motion.section key="result-success" className="screen result editorial-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="result-photo-wrap">
                  <motion.img layoutId="pizza-photo" src={preview} className="photo-card result-photo" alt="Pizza analisada" />
                  <span className="result-crust-ring" aria-hidden="true" />
                </div>

                <div className="product-identification">
                  <span className="result-kicker">PRODUTO PROVÁVEL</span>
                  <motion.h2 initial={{ opacity: 0, y: reduced ? 0 : 9 }} animate={{ opacity: 1, y: 0 }}>{result.pizzaName}</motion.h2>
                  <p>{recognitionText(result)}</p>
                </div>

                <section className="bench-sheet" aria-labelledby="bench-title">
                  <div className="bench-sheet-heading">
                    <div><span>CONFERÊNCIA GASTRONÔMICA</span><h3 id="bench-title">Leitura do padrão</h3></div>
                    <span className="quality-calibration">{qualityStatus === 'not_calibrated' ? 'Qualidade não calibrada' : 'Leitura experimental'}</span>
                  </div>

                  <div className="bench-readings">
                    {benchReadings.map((reading, index) => (
                      <motion.div className="bench-row" key={reading.label} initial={{ opacity: 0, y: reduced ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : index * .065 }}>
                        <div><span>{String(index + 1).padStart(2, '0')}</span><b>{reading.label}</b></div>
                        <p>{reading.signal?.observation || reading.fallback}</p>
                        <small>{reading.signal ? qualityStateLabel(reading.signal) : 'Comparação dependente da referência da casa'}</small>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {result.referenceImage && (
                  <motion.figure className="house-reference" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }}>
                    <img src={result.referenceImage} alt={`Referência da casa para ${result.pizzaName ?? 'este produto'}`} loading="lazy" />
                    <figcaption><span>REFERÊNCIA DA CASA</span><strong>{result.pizzaName}</strong><small>Referência visual de identidade. Ainda não é padrão operacional calibrado.</small></figcaption>
                  </motion.figure>
                )}

                {result.ingredients.length > 0 && (
                  <section className="technical-sheet">
                    <span>FICHA TÉCNICA · CONTEXTO VISUAL</span>
                    <h3>Ingredientes conhecidos do produto</h3>
                    <p>{result.ingredients.join(' · ')}</p>
                  </section>
                )}

                {result.quality_notes && result.quality_notes.length > 0 && (
                  <section className="quality-notes"><span>NOTAS DA LEITURA</span>{result.quality_notes.map(note => <p key={note}>{note}</p>)}</section>
                )}

                <div className="training-warning">
                  <ShieldCheck size={17}/>
                  <p><strong>POC LightPath · Em treinamento.</strong> Reconhecimento e qualidade ainda dependem de mais fotos reais da operação, treinamento, machine learning, calibração e regras da La Braciera. Esta leitura não deve ser usada como controle operacional e não representa aprovação ou reprovação da pizza.</p>
                </div>

                <motion.button className="primary" whileTap={reduced ? undefined : { scale: .985 }} onClick={reset}><RotateCcw/> Conferir outra pizza</motion.button>
              </motion.section>
            )
          )}

          {view === 'error' && (
            <motion.section key="error" className="screen error-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <XCircle size={38}/><span className="result-kicker">LEITURA INTERROMPIDA</span><h2>Não consegui fechar a conferência.</h2><p>{error}</p><p className="truth-note">Nenhum produto nem avaliação de qualidade foi inventado.</p><button className="primary" onClick={reset}><RotateCcw/> Começar novamente</button>
            </motion.section>
          )}
        </AnimatePresence>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile}/>
        <footer>POC desenvolvida por <strong>LightPath Tecnologia</strong> · não operacional</footer>
      </main>
    </MotionConfig>
  )
}
