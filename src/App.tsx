import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChangeEvent, useEffect, useRef, useState } from 'react'

type AppStep = 'home' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'
type AnalysisStatus = 'success' | 'inconclusive' | 'error'

type QualitySignal = {
  label: string
  state?: 'good' | 'attention' | 'unknown'
  detail?: string
}

type Alternative = {
  pizzaId?: string
  pizzaName: string
  confidenceScore?: number
}

type AnalysisResult = {
  status: AnalysisStatus
  pizzaId?: string | null
  pizzaName?: string | null
  confidenceLabel?: string | null
  confidenceScore?: number | null
  alternatives?: Alternative[]
  ingredients?: string[]
  referenceImage?: string | null
  qualitySignals?: QualitySignal[]
  warnings?: string[]
  nutritionSource?: string | null
  message?: string | null
}

type ApiQualitySignal = {
  state?: string
  observation?: string
}

type ApiAnalysisResult = Omit<AnalysisResult, 'qualitySignals'> & {
  qualitySignals?: QualitySignal[] | Record<string, ApiQualitySignal>
}

type PreparedImage = {
  blob: Blob
  previewUrl: string
  source: 'camera' | 'gallery'
}

const ANALYSIS_STAGES = [
  'Lendo formato e cobertura',
  'Comparando com o cardápio',
  'Avaliando o padrão visual',
]

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

function Icon({ name }: { name: 'camera' | 'image' | 'spark' | 'back' | 'refresh' | 'check' | 'warning' }) {
  const paths: Record<typeof name, JSX.Element> = {
    camera: <><path d="M5 7h2l1.2-2h7.6L17 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
    spark: <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/>,
    back: <path d="m15 18-6-6 6-6"/>,
    refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7L20 9"/><path d="M20 4v5h-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16h.01"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-label="La Braciera — Braciera Vision">
      <span className="brand-kicker">LA BRACIERA</span>
      <span className="brand-title">Braciera Vision</span>
    </div>
  )
}

function App() {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<AppStep>('home')
  const [prepared, setPrepared] = useState<PreparedImage | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl)
  }, [prepared?.previewUrl])

  useEffect(() => {
    if (step !== 'analyzing') return
    const id = window.setInterval(() => setStageIndex((current) => (current + 1) % ANALYSIS_STAGES.length), 1350)
    return () => window.clearInterval(id)
  }, [step])

  const replacePrepared = (next: PreparedImage | null) => {
    setPrepared((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return next
    })
  }

  const useBlob = (blob: Blob, source: PreparedImage['source']) => {
    replacePrepared({ blob, previewUrl: URL.createObjectURL(blob), source })
    setResult(null)
    setError(null)
    setStep('preview')
  }

  const onGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      useBlob(await normalizeImage(file), 'gallery')
    } catch {
      setError('Não foi possível preparar esta imagem. Tente outra foto em JPEG, PNG ou HEIC compatível com o navegador.')
      setStep('error')
    }
  }

  const analyze = async () => {
    if (!prepared) return
    setStageIndex(0)
    setError(null)
    setStep('analyzing')
    try {
      if (!API_BASE) throw new Error('A API de análise ainda não foi configurada neste ambiente.')
      const form = new FormData()
      form.append('image', prepared.blob, 'pizza.jpg')
      const response = await fetch(`${API_BASE}/api/v1/analyze`, { method: 'POST', body: form })
      const payload = await response.json().catch(() => null) as ApiAnalysisResult | null
      if (!response.ok) throw new Error(payload?.message || (response.status >= 500 ? 'O serviço de análise está temporariamente indisponível.' : 'Não foi possível analisar esta imagem.'))
      if (!payload || !['success', 'inconclusive', 'error'].includes(payload.status)) throw new Error('A resposta da análise veio em um formato inesperado.')
      if (payload.status === 'error') throw new Error(payload.message || 'A análise não pôde ser concluída.')
      setResult(normalizeAnalysisResult(payload))
      setStep('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha inesperada durante a análise.')
      setStep('error')
    }
  }

  const reset = () => {
    replacePrepared(null)
    setResult(null)
    setError(null)
    setStep('home')
  }

  return (
    <main className="app-shell">
      <div className="ambient" aria-hidden="true"><span/><span/><span/></div>
      <header className="topbar">
        <BrandMark />
        <span className="prototype-pill">protótipo</span>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'home' && (
          <motion.section key="home" className="screen home-screen" {...fade(reduceMotion)}>
            <div className="hero-copy">
              <motion.div className="eyebrow" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .08 }}>
                <Icon name="spark" /> Visão aplicada à excelência
              </motion.div>
              <motion.h1 initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42 }}>
                Cada pizza conta uma história visual.
              </motion.h1>
              <motion.p initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, delay: .08 }}>
                Fotografe uma pizza La Braciera para reconhecer o sabor e visualizar uma prévia experimental do padrão visual.
              </motion.p>
            </div>

            <div className="hero-orbit" aria-hidden="true">
              <div className="plate"><div className="pizza-placeholder"><i/><i/><i/><i/><i/></div></div>
              <span className="orbit-ring"/>
            </div>

            <div className="actions-stack">
              <button className="button primary" onClick={() => setStep('camera')}><Icon name="camera"/><span>Tirar foto</span></button>
              <button className="button secondary" onClick={() => fileInputRef.current?.click()}><Icon name="image"/><span>Anexar do dispositivo</span></button>
            </div>
            <p className="privacy-note">A foto só é enviada quando você tocar em “Analisar pizza”.</p>
          </motion.section>
        )}

        {step === 'camera' && (
          <CameraScreen key="camera" onClose={() => setStep('home')} onGallery={() => fileInputRef.current?.click()} onCapture={async (blob) => useBlob(await normalizeImage(blob), 'camera')} />
        )}

        {step === 'preview' && prepared && (
          <motion.section key="preview" className="screen preview-screen" {...fade(reduceMotion)}>
            <div className="section-heading"><span className="step-label">Foto pronta</span><h2>Esta imagem está boa?</h2><p>Prefira a pizza inteira no quadro e pequena margem ao redor.</p></div>
            <motion.div layoutId="captured-pizza" className="photo-card"><img src={prepared.previewUrl} alt="Pizza pronta para análise" /></motion.div>
            <div className="actions-stack sticky-actions">
              <button className="button primary" onClick={analyze}><Icon name="spark"/><span>Analisar pizza</span></button>
              <button className="button ghost" onClick={() => prepared.source === 'camera' ? setStep('camera') : fileInputRef.current?.click()}><Icon name="refresh"/><span>{prepared.source === 'camera' ? 'Tirar novamente' : 'Escolher outra foto'}</span></button>
            </div>
          </motion.section>
        )}

        {step === 'analyzing' && prepared && (
          <motion.section key="analyzing" className="screen analyzing-screen" {...fade(reduceMotion)} aria-live="polite">
            <div className="analysis-copy"><span className="step-label">Braciera Vision</span><h2>Analisando sua pizza</h2><p>Comparando a imagem com referências controladas do cardápio.</p></div>
            <motion.div layoutId="captured-pizza" className="photo-card scanning-card">
              <img src={prepared.previewUrl} alt="Pizza em análise" />
              {!reduceMotion && <motion.span className="scan-line" initial={{ y: '-12%' }} animate={{ y: '760%' }} transition={{ duration: 2.15, ease: 'easeInOut', repeat: Infinity, repeatDelay: .25 }} />}
              <span className="scan-frame" aria-hidden="true"/>
            </motion.div>
            <div className="analysis-stage">
              <span className="activity-dot" aria-hidden="true"/>
              <AnimatePresence mode="wait">
                <motion.span key={stageIndex} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}>{ANALYSIS_STAGES[stageIndex]}</motion.span>
              </AnimatePresence>
            </div>
          </motion.section>
        )}

        {step === 'result' && prepared && result && (
          <ResultScreen key="result" prepared={prepared} result={result} onReset={reset} reduceMotion={Boolean(reduceMotion)} />
        )}

        {step === 'error' && (
          <motion.section key="error" className="screen state-screen" {...fade(reduceMotion)}>
            <div className="state-icon"><Icon name="warning"/></div>
            <span className="step-label">Não foi possível concluir</span>
            <h2>Vamos tentar de novo.</h2>
            <p>{error || 'Houve uma falha inesperada.'}</p>
            <div className="tip-card"><strong>Dica para a demonstração</strong><span>Use boa luz, fotografe de cima e mantenha a pizza inteira visível.</span></div>
            <div className="actions-stack"><button className="button primary" onClick={() => prepared ? setStep('preview') : reset()}><Icon name="refresh"/><span>Tentar novamente</span></button><button className="button ghost" onClick={reset}>Voltar ao início</button></div>
          </motion.section>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={onGallery} />
      <footer>Powered by <strong>LightPath</strong></footer>
    </main>
  )
}

function CameraScreen({ onClose, onGallery, onCapture }: { onClose: () => void; onGallery: () => void; onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    navigator.mediaDevices?.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (!active) return stream.getTracks().forEach((track) => track.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((err: DOMException) => {
        setCameraError(err.name === 'NotAllowedError' ? 'A câmera foi bloqueada. Libere a permissão no navegador ou use uma foto do dispositivo.' : 'A câmera não está disponível neste dispositivo. Você ainda pode anexar uma foto.')
      })
    return () => { active = false; streamRef.current?.getTracks().forEach((track) => track.stop()) }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', .9)
  }

  return (
    <motion.section className="camera-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <video ref={videoRef} autoPlay playsInline muted onCanPlay={() => setReady(true)} />
      <div className="camera-shade" aria-hidden="true"/>
      <button className="icon-button camera-back" aria-label="Fechar câmera" onClick={onClose}><Icon name="back"/></button>
      <div className={`camera-guide ${ready ? 'ready' : ''}`}><span/><span/><span/><span/><div className="guide-copy"><strong>Enquadre a pizza inteira</strong><small>Deixe uma pequena margem ao redor.</small></div></div>
      {cameraError && <div className="camera-error"><Icon name="warning"/><p>{cameraError}</p></div>}
      <div className="camera-controls">
        <button className="gallery-shortcut" onClick={onGallery}><Icon name="image"/><span>Galeria</span></button>
        <button className="shutter" disabled={!ready || Boolean(cameraError)} aria-label="Tirar foto" onClick={capture}><span/></button>
        <span className="control-spacer"/>
      </div>
    </motion.section>
  )
}

function ResultScreen({ prepared, result, onReset, reduceMotion }: { prepared: PreparedImage; result: AnalysisResult; onReset: () => void; reduceMotion: boolean }) {
  const isInconclusive = result.status === 'inconclusive'
  if (isInconclusive) return (
    <motion.section className="screen state-screen" {...fade(reduceMotion)}>
      <motion.div layoutId="captured-pizza" className="photo-card compact-photo"><img src={prepared.previewUrl} alt="Pizza analisada" /></motion.div>
      <div className="state-icon neutral"><Icon name="spark"/></div><span className="step-label">Análise inconclusiva</span><h2>Precisamos de mais evidência visual.</h2>
      <p>{result.message || 'Não há confiança suficiente para identificar esta pizza com segurança.'}</p>
      <div className="tip-card"><strong>Para melhorar a leitura</strong><span>Fotografe de cima, evite reflexos e mantenha a pizza inteira no enquadramento.</span></div>
      <button className="button primary" onClick={onReset}><Icon name="camera"/><span>Fazer nova análise</span></button>
    </motion.section>
  )

  return (
    <motion.section className="screen result-screen" {...fade(reduceMotion)}>
      <motion.div layoutId="captured-pizza" className="photo-card result-photo"><img src={prepared.previewUrl} alt="Pizza analisada" /><span className="recognized-badge"><Icon name="check"/> Reconhecida</span></motion.div>
      <motion.div className="result-heading" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 210, damping: 22 }}>
        <span className="step-label">Resultado provável</span><h2>{result.pizzaName || 'Pizza identificada'}</h2>
        {result.confidenceLabel && <div className="confidence"><span>Confiança</span><strong>{result.confidenceLabel}</strong>{typeof result.confidenceScore === 'number' && <small>{Math.round(result.confidenceScore * 100)}%</small>}</div>}
      </motion.div>

      {result.ingredients?.length ? <section className="result-block"><h3>Ingredientes</h3><div className="chips">{result.ingredients.map((ingredient, index) => <motion.span key={ingredient} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .055 }}>{ingredient}</motion.span>)}</div></section> : null}

      {result.referenceImage && <section className="result-block"><div className="block-title"><h3>Referência oficial</h3><span>cardápio</span></div><div className="reference-card"><img src={result.referenceImage} alt={`Referência oficial de ${result.pizzaName || 'pizza'}`} /></div></section>}

      {result.qualitySignals?.length ? <section className="result-block"><div className="block-title"><h3>Prévia de padrão visual</h3><span>experimental</span></div><div className="signal-list">{result.qualitySignals.map((signal, index) => <motion.div className={`signal ${signal.state || 'unknown'}`} key={signal.label} initial={reduceMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .08 * index }}><span className="signal-dot"/><div><strong>{signal.label}</strong>{signal.detail && <small>{signal.detail}</small>}</div></motion.div>)}</div><p className="experimental-note">Estes sinais são demonstrativos até calibração com critérios e imagens aprovados pela La Braciera.</p></section> : null}

      {result.alternatives?.length ? <details className="alternatives"><summary>Outras possibilidades</summary>{result.alternatives.map((alternative) => <div key={`${alternative.pizzaId}-${alternative.pizzaName}`}><span>{alternative.pizzaName}</span>{typeof alternative.confidenceScore === 'number' && <small>{Math.round(alternative.confidenceScore * 100)}%</small>}</div>)}</details> : null}
      {result.warnings?.map((warning) => <p className="warning-note" key={warning}>{warning}</p>)}
      <button className="button primary" onClick={onReset}><Icon name="camera"/><span>Analisar outra pizza</span></button>
    </motion.section>
  )
}

const QUALITY_LABELS: Record<string, string> = {
  shape: 'Formato / circularidade',
  bake: 'Assamento visual',
  crust: 'Borda / cornicione',
  toppingDistribution: 'Distribuição de ingredientes',
  expectedIngredients: 'Ingredientes esperados',
}

function normalizeAnalysisResult(payload: ApiAnalysisResult): AnalysisResult {
  const rawSignals = payload.qualitySignals
  const qualitySignals = Array.isArray(rawSignals)
    ? rawSignals
    : rawSignals
      ? Object.entries(rawSignals).map(([key, signal]) => ({
          label: QUALITY_LABELS[key] || humanizeKey(key),
          state: signal.state === 'positive' ? 'good' : signal.state === 'negative' ? 'attention' : 'unknown',
          detail: signal.observation,
        }) satisfies QualitySignal)
      : undefined

  return { ...payload, qualitySignals }
}

function humanizeKey(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase())
}

async function normalizeImage(input: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) { bitmap.close(); throw new Error('Canvas indisponível') }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao converter imagem')), 'image/jpeg', .86))
}

function fade(reduced: boolean | null) {
  return reduced ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -5 }, transition: { duration: .28 } }
}

export default App
