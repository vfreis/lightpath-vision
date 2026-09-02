import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { z } from "zod";

const CropSchema = z.object({
  left: z.number().int().nonnegative(),
  top: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

const ReferenceSchema = z.object({
  sourcePage: z.number().int().positive(),
  cropBox: CropSchema,
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  officialSource: z.string().url(),
  kind: z.literal("official_menu_supervised_crop"),
  notes: z.string().optional()
});

const ManifestSchema = z.record(z.string(), ReferenceSchema);
type SupervisedReference = z.infer<typeof ReferenceSchema>;

function candidateManifestPaths(): string[] {
  return [
    resolve(process.cwd(), "data/reference-crops.json"),
    resolve(process.cwd(), "../data/reference-crops.json")
  ];
}

function loadManifest(): Record<string, SupervisedReference> {
  const path = candidateManifestPaths().find((candidate) => existsSync(candidate));
  if (!path) return {};
  return ManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

const manifest = loadManifest();
const cropCache = new Map<string, Promise<string | null>>();
const pageAssetCache = new Map<string, Promise<string[]>>();
const pageBufferCache = new Map<string, Promise<Buffer | null>>();

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*[\"']([^\"']+)[\"']`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function isAllowedReferenceUrl(value: string, source: string): boolean {
  try {
    const url = new URL(value, source);
    if (url.protocol !== "https:") return false;
    const sourceHost = new URL(source).hostname.replace(/^www\./, "");
    const host = url.hostname.replace(/^www\./, "");
    return host === sourceHost || host.endsWith(`.${sourceHost}`);
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; LightPathVision/1.0; +https://lightpath.tech)" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`reference_page_http_${response.status}`);
  return response.text();
}

function extractMenuPageAssets(html: string, source: string): string[] {
  const byPage = new Map<number, string>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = attr(tag, "alt") ?? "";
    const pageMatch = alt.match(/Card[aá]pio La Braciera,\s*p[aá]gina\s*(\d+)/i);
    if (!pageMatch) continue;
    const page = Number(pageMatch[1]);
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    if (!src) continue;
    const resolved = new URL(src, source).toString();
    if (!isAllowedReferenceUrl(resolved, source)) continue;
    byPage.set(page, resolved);
  }
  return [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([, url]) => url);
}

async function pageAssets(source: string): Promise<string[]> {
  const existing = pageAssetCache.get(source);
  if (existing) return existing;
  const promise = (async () => {
    const html = await fetchText(source);
    const assets = extractMenuPageAssets(html, source);
    if (!assets.length) throw new Error("reference_page_assets_not_found");
    return assets;
  })();
  pageAssetCache.set(source, promise);
  return promise;
}

async function fetchPageBuffer(source: string, page: number): Promise<Buffer | null> {
  const key = `${source}#${page}`;
  const existing = pageBufferCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const assets = await pageAssets(source);
      const imageUrl = assets[page - 1];
      if (!imageUrl || !isAllowedReferenceUrl(imageUrl, source)) return null;
      const response = await fetch(imageUrl, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; LightPathVision/1.0; +https://lightpath.tech)" },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  })();

  pageBufferCache.set(key, promise);
  return promise;
}

function scaledCrop(reference: SupervisedReference, actualWidth: number, actualHeight: number) {
  const xScale = actualWidth / reference.sourceWidth;
  const yScale = actualHeight / reference.sourceHeight;
  const left = Math.max(0, Math.round(reference.cropBox.left * xScale));
  const top = Math.max(0, Math.round(reference.cropBox.top * yScale));
  const width = Math.min(actualWidth - left, Math.max(1, Math.round(reference.cropBox.width * xScale)));
  const height = Math.min(actualHeight - top, Math.max(1, Math.round(reference.cropBox.height * yScale)));
  return { left, top, width, height };
}

export function hasSupervisedReference(slug: string): boolean {
  return Boolean(manifest[slug]);
}

export function supervisedReferenceInfo(slug: string): SupervisedReference | null {
  return manifest[slug] ?? null;
}

export function supervisedReferenceIds(): string[] {
  return Object.keys(manifest);
}

export async function supervisedReferenceDataUrl(slug: string): Promise<string | null> {
  const existing = cropCache.get(slug);
  if (existing) return existing;

  const promise = (async () => {
    const reference = manifest[slug];
    if (!reference) return null;
    const page = await fetchPageBuffer(reference.officialSource, reference.sourcePage);
    if (!page) return null;

    const metadata = await sharp(page).metadata();
    if (!metadata.width || !metadata.height) return null;
    const crop = scaledCrop(reference, metadata.width, metadata.height);

    const image = await sharp(page)
      .extract(crop)
      .resize(640, 640, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();

    return `data:image/jpeg;base64,${image.toString("base64")}`;
  })();

  cropCache.set(slug, promise);
  return promise;
}
