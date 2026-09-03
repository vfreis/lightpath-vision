import sharp from "sharp";

export const TRAINING_BUNDLE_QUALITY_VERSION = "quality-signal-profile.v1";
export const QUALITY_SIGNAL_CONTRACT_VERSION = "observable-signals.v1";

export type ObservableSignalState = "observed" | "limited" | "not_visible";

export type ObservableSignals = {
  crust: {
    state: ObservableSignalState;
    crustWidthProxy: number | null;
    edgeDensity: number | null;
    centerToCrustValueDelta: number | null;
    note: string;
  };
  leopardSpotting: {
    state: ObservableSignalState;
    darkRatio: number | null;
    note: string;
  };
  texture: {
    state: ObservableSignalState;
    grayStd: number | null;
    edgeDensity: number | null;
    note: string;
  };
  blur: {
    state: ObservableSignalState;
    laplacianVariance: number | null;
    note: string;
  };
  shape: {
    state: ObservableSignalState;
    areaRatio: number | null;
    circularity: number | null;
    aspectRatio: number | null;
    note: string;
  };
  radialDistribution: {
    state: ObservableSignalState;
    centerValue: number | null;
    midValue: number | null;
    crustValue: number | null;
    centerToCrustValueDelta: number | null;
    note: string;
  };
  semanticCues: {
    state: ObservableSignalState;
    ratios: {
      red: number;
      green: number;
      yellow: number;
      dark: number;
      cream: number;
      brownToast: number;
      highSaturation: number;
    };
    cues: string[];
    note: string;
  };
  meta: {
    source: "training_bundle_observable_scaffold";
    bundleVersion: string;
    calibratedQuality: false;
  };
};

type Hsv = { h: number; s: number; v: number };

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = max === 0 ? 0 : delta / max;
  return { h: hue / 2, s: saturation * 255, v: max * 255 };
}

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function std(values: number[]): number {
  if (!values.length) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)));
}

function largestComponent(mask: Uint8Array, width: number, height: number): Uint8Array {
  const seen = new Uint8Array(mask.length);
  let best: number[] = [];
  const queue: number[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const component: number[] = [];
    queue.length = 0;
    queue.push(start);
    seen[start] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1
      ];
      for (const next of neighbors) {
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (component.length > best.length) best = component;
  }

  const result = new Uint8Array(mask.length);
  for (const index of best) result[index] = 1;
  return result;
}

function buildRings(mask: Uint8Array, width: number, height: number) {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) points.push({ x: i % width, y: Math.floor(i / width) });
  }
  if (points.length < 10) {
    return { center: new Uint8Array(mask.length), mid: new Uint8Array(mask.length), crust: new Uint8Array(mask.length) };
  }
  const cx = mean(points.map((point) => point.x));
  const cy = mean(points.map((point) => point.y));
  let radius = 1;
  for (const point of points) radius = Math.max(radius, Math.hypot(point.x - cx, point.y - cy));
  const center = new Uint8Array(mask.length);
  const mid = new Uint8Array(mask.length);
  const crust = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const rr = Math.hypot(x - cx, y - cy) / radius;
    if (rr <= 0.38) center[i] = 1;
    else if (rr <= 0.72) mid[i] = 1;
    else if (rr <= 1.05) crust[i] = 1;
  }
  return { center, mid, crust };
}

function maskedMean(values: Float64Array, mask: Uint8Array): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    sum += values[i]!;
    count += 1;
  }
  return count ? sum / count : 0;
}

function signalState(maskCount: number, imagePixels: number): ObservableSignalState {
  if (maskCount < 200) return "not_visible";
  if (maskCount / imagePixels < 0.2) return "limited";
  return "observed";
}

export async function extractObservableSignals(image: Buffer): Promise<ObservableSignals> {
  const { data, info } = await sharp(image)
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = width * height;
  const gray = new Float64Array(pixels);
  const value = new Float64Array(pixels);
  const initialMask = new Uint8Array(pixels);
  const hsvs: Hsv[] = new Array(pixels);

  for (let i = 0; i < pixels; i += 1) {
    const offset = i * channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const hsv = rgbToHsv(r, g, b);
    hsvs[i] = hsv;
    value[i] = hsv.v;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r + g + b > 30 && (hsv.s > 20 || hsv.v > 45)) initialMask[i] = 1;
  }

  const mask = largestComponent(initialMask, width, height);
  let maskCount = 0;
  for (const bit of mask) maskCount += bit;
  const state = signalState(maskCount, pixels);
  const rings = buildRings(mask, width, height);

  const laplacians: number[] = [];
  let edgeCount = 0;
  let perimeter = 0;
  const grayValues: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const current = gray[i]!;
      grayValues.push(current);
      const lap = gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]! - 4 * current;
      laplacians.push(lap);
      const gx = gray[i + 1]! - gray[i - 1]!;
      const gy = gray[i + width]! - gray[i - width]!;
      if (Math.hypot(gx, gy) > 55) edgeCount += 1;
      if (!mask[i - 1] || !mask[i + 1] || !mask[i - width] || !mask[i + width]) perimeter += 1;
    }
  }

  const lapMean = mean(laplacians);
  const lapVariance = laplacians.length ? mean(laplacians.map((v) => (v - lapMean) ** 2)) : 0;
  const edgeDensity = maskCount ? edgeCount / maskCount : 0;
  const grayStd = std(grayValues);
  const areaRatio = pixels ? maskCount / pixels : 0;
  const circularity = perimeter > 0 ? Math.min(1, (4 * Math.PI * maskCount) / (perimeter * perimeter)) : 0;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const bboxWidth = maxX >= minX ? maxX - minX + 1 : 0;
  const bboxHeight = maxY >= minY ? maxY - minY + 1 : 0;
  const aspectRatio = bboxHeight ? bboxWidth / bboxHeight : 0;

  let crustCount = 0;
  let crustDark = 0;
  let crustEdges = 0;
  for (let i = 0; i < rings.crust.length; i += 1) {
    if (!rings.crust[i]) continue;
    crustCount += 1;
    if (value[i]! < 90) crustDark += 1;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x > 0 && x + 1 < width && y > 0 && y + 1 < height) {
      const gx = gray[i + 1]! - gray[i - 1]!;
      const gy = gray[i + width]! - gray[i - width]!;
      if (Math.hypot(gx, gy) > 55) crustEdges += 1;
    }
  }
  const crustWidthProxy = maskCount ? crustCount / maskCount : 0;
  const crustDarkRatio = crustCount ? crustDark / crustCount : 0;
  const crustEdgeDensity = crustCount ? crustEdges / crustCount : 0;
  const centerValue = maskedMean(value, rings.center);
  const midValue = maskedMean(value, rings.mid);
  const crustValue = maskedMean(value, rings.crust);
  const centerToCrustValueDelta = centerValue - crustValue;

  let red = 0;
  let green = 0;
  let yellow = 0;
  let dark = 0;
  let cream = 0;
  let brownToast = 0;
  let highSaturation = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const hsv = hsvs[i]!;
    if ((hsv.h < 12 || hsv.h > 168) && hsv.s > 80 && hsv.v > 45) red += 1;
    if (hsv.h >= 35 && hsv.h <= 90 && hsv.s > 55 && hsv.v > 40) green += 1;
    if (hsv.h >= 15 && hsv.h <= 35 && hsv.s > 60 && hsv.v > 70) yellow += 1;
    if (hsv.v < 75) dark += 1;
    if (hsv.s < 55 && hsv.v > 145) cream += 1;
    if (hsv.h >= 5 && hsv.h <= 25 && hsv.s > 55 && hsv.v >= 45 && hsv.v < 165) brownToast += 1;
    if (hsv.s > 140) highSaturation += 1;
  }
  const divisor = Math.max(maskCount, 1);
  const ratios = {
    red: round(red / divisor),
    green: round(green / divisor),
    yellow: round(yellow / divisor),
    dark: round(dark / divisor),
    cream: round(cream / divisor),
    brownToast: round(brownToast / divisor),
    highSaturation: round(highSaturation / divisor)
  };
  const cues: string[] = [];
  if (ratios.red >= 0.08) cues.push("vermelhos/tomate aparentes");
  if (ratios.green >= 0.025) cues.push("verdes/folhas aparentes");
  if (ratios.cream >= 0.08) cues.push("queijo/cremes claros aparentes");
  if (ratios.brownToast >= 0.04) cues.push("tons tostados aparentes");
  if (ratios.dark >= 0.05) cues.push("áreas escuras aparentes");

  const blurState: ObservableSignalState = state === "not_visible" ? "not_visible" : lapVariance < 70 ? "limited" : "observed";
  const crustState: ObservableSignalState = state === "observed" && crustCount > 100 ? "observed" : state;

  return {
    crust: {
      state: crustState,
      crustWidthProxy: crustCount ? round(crustWidthProxy) : null,
      edgeDensity: crustCount ? round(crustEdgeDensity) : null,
      centerToCrustValueDelta: crustCount ? round(centerToCrustValueDelta, 2) : null,
      note: crustState === "observed"
        ? "Cornicione visível para leitura experimental de largura, textura e contraste."
        : "Cornicione com visibilidade limitada nesta foto."
    },
    leopardSpotting: {
      state: crustState,
      darkRatio: crustCount ? round(crustDarkRatio) : null,
      note: crustState === "observed"
        ? "Pontos escuros no anel externo medidos como proxy visual de leoparding/ponto de forno."
        : "Pontos de forno não estão legíveis o suficiente para uma leitura estável."
    },
    texture: {
      state,
      grayStd: maskCount ? round(grayStd, 2) : null,
      edgeDensity: maskCount ? round(edgeDensity) : null,
      note: state === "observed"
        ? "Textura e densidade de bordas visíveis na montagem."
        : "Textura com leitura limitada pelo enquadramento da foto."
    },
    blur: {
      state: blurState,
      laplacianVariance: laplacians.length ? round(lapVariance, 2) : null,
      note: blurState === "limited"
        ? "A nitidez limita a conferência fina de montagem e cornicione."
        : blurState === "observed"
          ? "Nitidez suficiente para a leitura visual experimental."
          : "Nitidez não pôde ser estimada com segurança."
    },
    shape: {
      state,
      areaRatio: maskCount ? round(areaRatio) : null,
      circularity: maskCount ? round(circularity) : null,
      aspectRatio: bboxHeight ? round(aspectRatio) : null,
      note: state === "observed"
        ? "Forma aparente e ocupação do quadro medidas como proxies geométricos, sem reprovação de produto."
        : "A forma completa do produto não está suficientemente visível."
    },
    radialDistribution: {
      state: crustCount ? state : "not_visible",
      centerValue: rings.center.some(Boolean) ? round(centerValue, 2) : null,
      midValue: rings.mid.some(Boolean) ? round(midValue, 2) : null,
      crustValue: crustCount ? round(crustValue, 2) : null,
      centerToCrustValueDelta: crustCount ? round(centerToCrustValueDelta, 2) : null,
      note: crustCount
        ? "Centro, faixa intermediária e cornicione comparados radialmente para leitura de distribuição."
        : "Distribuição radial não pôde ser lida nesta foto."
    },
    semanticCues: {
      state,
      ratios,
      cues,
      note: cues.length
        ? `Cores semânticas aparentes: ${cues.join(", ")}. Não inferir ingrediente oculto.`
        : "Cores semânticas sem sinal dominante; não inferir ingredientes ocultos."
    },
    meta: {
      source: "training_bundle_observable_scaffold",
      bundleVersion: TRAINING_BUNDLE_QUALITY_VERSION,
      calibratedQuality: false
    }
  };
}

export function serializeObservableSignalsForModel(signals: ObservableSignals): string {
  return JSON.stringify({
    source: signals.meta.source,
    calibratedQuality: false,
    crust: signals.crust,
    leopardSpotting: signals.leopardSpotting,
    texture: signals.texture,
    blur: signals.blur,
    shape: signals.shape,
    radialDistribution: signals.radialDistribution,
    semanticCues: signals.semanticCues
  });
}
