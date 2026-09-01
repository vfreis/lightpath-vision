const MAX_EDGE = 1600
const JPEG_QUALITY = 0.86

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      return await createImageBitmap(file)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function normalizeImage(file: Blob, filename = 'pizza.jpg'): Promise<File> {
  const source = await decode(file)
  const width = source.width
  const height = source.height
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('IMAGE_CONTEXT_UNAVAILABLE')
  ctx.drawImage(source, 0, 0, outW, outH)
  if ('close' in source && typeof source.close === 'function') source.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('IMAGE_ENCODE_FAILED')), 'image/jpeg', JPEG_QUALITY)
  })
  return new File([blob], filename.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

export function canvasCapture(video: HTMLVideoElement): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return Promise.reject(new Error('CAMERA_CAPTURE_FAILED'))
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('CAMERA_CAPTURE_FAILED'))
      normalizeImage(blob, 'camera-pizza.jpg').then(resolve, reject)
    }, 'image/jpeg', 0.92)
  })
}
