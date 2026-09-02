export type CaptureIssue = 'low_resolution' | 'low_light' | 'overexposed' | 'motion' | 'low_detail'

export type FrameSample = {
  luma: Float32Array
  meanLuma: number
  detail: number
  sourceWidth: number
  sourceHeight: number
}

export type CaptureAssessment = {
  ok: boolean
  issue?: CaptureIssue
  motionScore: number
}

export function sampleVideoFrame(video: HTMLVideoElement, targetWidth = 96): FrameSample | null {
  if (!video.videoWidth || !video.videoHeight) return null

  const targetHeight = Math.max(64, Math.round(targetWidth * video.videoHeight / video.videoWidth))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) return null

  context.drawImage(video, 0, 0, targetWidth, targetHeight)
  const pixels = context.getImageData(0, 0, targetWidth, targetHeight).data
  const luma = new Float32Array(targetWidth * targetHeight)
  let sum = 0
  let detail = 0

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const pixelIndex = (y * targetWidth + x) * 4
      const value = pixels[pixelIndex] * .2126 + pixels[pixelIndex + 1] * .7152 + pixels[pixelIndex + 2] * .0722
      const index = y * targetWidth + x
      luma[index] = value
      sum += value
      if (x > 0) detail += Math.abs(value - luma[index - 1])
      if (y > 0) detail += Math.abs(value - luma[index - targetWidth])
    }
  }

  const count = luma.length
  return {
    luma,
    meanLuma: sum / count,
    detail: detail / Math.max(1, count * 2),
    sourceWidth: video.videoWidth,
    sourceHeight: video.videoHeight
  }
}

export function assessCapturePair(before: FrameSample, after: FrameSample): CaptureAssessment {
  const minEdge = Math.min(after.sourceWidth, after.sourceHeight)
  if (minEdge < 480) return { ok: false, issue: 'low_resolution', motionScore: 0 }
  if (after.meanLuma < 28) return { ok: false, issue: 'low_light', motionScore: 0 }
  if (after.meanLuma > 238) return { ok: false, issue: 'overexposed', motionScore: 0 }

  const count = Math.min(before.luma.length, after.luma.length)
  let motion = 0
  for (let index = 0; index < count; index += 1) motion += Math.abs(before.luma[index] - after.luma[index])
  const motionScore = motion / Math.max(1, count)

  if (motionScore > 17) return { ok: false, issue: 'motion', motionScore }
  if (after.detail < 2.5) return { ok: false, issue: 'low_detail', motionScore }
  return { ok: true, motionScore }
}
