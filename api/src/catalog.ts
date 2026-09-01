import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { config } from "./config.js";

const MenuItemSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  category: z.string().min(1),
  ingredients: z.array(z.string()).nullable(),
  source: z.string().min(1),
  sourceDate: z.string().nullable().optional().default(null),
  confidenceTier: z.enum(["A", "B", "C"]),
  recognitionEnabled: z.boolean(),
  referenceImages: z.array(z.string()).default([]),
  availabilityStatus: z.enum(["current_listed", "current_listed_unverified", "availability_conflict"]).optional(),
  notes: z.string().optional()
});

const CatalogSchema = z.array(MenuItemSchema).min(1);
const ReferenceImageSchema = z.record(z.string(), z.array(z.string().url()));
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const EXPECTED_CATALOG_SIZE = 36;
export const EXPECTED_RECOGNITION_CLASSES = 36;

function candidatePaths(): string[] {
  const explicit = config.MENU_CATALOG_PATH ? [resolve(config.MENU_CATALOG_PATH)] : [];
  return [
    ...explicit,
    resolve(process.cwd(), "data/menu.json"),
    resolve(process.cwd(), "../data/menu.json"),
    resolve(process.cwd(), "api/data/bootstrap-menu.json"),
    resolve(process.cwd(), "data/bootstrap-menu.json")
  ];
}

function referencePaths(): string[] {
  return [
    resolve(process.cwd(), "data/reference-images.json"),
    resolve(process.cwd(), "../data/reference-images.json")
  ];
}

function loadReferenceImages(): { references: Record<string, string[]>; rawText: string } {
  const path = referencePaths().find((value) => existsSync(value));
  if (!path) return { references: {}, rawText: "" };
  const rawText = readFileSync(path, "utf8");
  return { references: ReferenceImageSchema.parse(JSON.parse(rawText)), rawText };
}

function loadCatalog(): { items: MenuItem[]; sourcePath: string; version: string } {
  const path = candidatePaths().find((value) => existsSync(value));
  if (!path) throw new Error("catalog_not_found");

  const rawText = readFileSync(path, "utf8");
  const raw = JSON.parse(rawText);
  const parsed = CatalogSchema.parse(raw);
  const slugs = new Set<string>();
  for (const item of parsed) {
    if (slugs.has(item.slug)) throw new Error(`duplicate_catalog_slug:${item.slug}`);
    slugs.add(item.slug);
  }

  const overlay = loadReferenceImages();
  const items = parsed.map((item) => {
    const verified = overlay.references[item.slug];
    if (!verified?.length) return item;
    return { ...item, referenceImages: [...new Set([...item.referenceImages, ...verified])] };
  });

  const versionInput = overlay.rawText ? `${rawText}\n${overlay.rawText}` : rawText;
  const version = `sha256:${createHash("sha256").update(versionInput).digest("hex").slice(0, 12)}`;
  return { items, sourcePath: path, version };
}

const loaded = loadCatalog();
export const catalog = loaded.items;
export const catalogSourcePath = loaded.sourcePath;
export const catalogVersion = loaded.version;
export const enabledCatalog = catalog.filter((item) => item.recognitionEnabled);

if (catalog.length !== EXPECTED_CATALOG_SIZE) {
  throw new Error(`catalog_size_mismatch:${catalog.length}:expected:${EXPECTED_CATALOG_SIZE}`);
}
if (enabledCatalog.length !== EXPECTED_RECOGNITION_CLASSES) {
  throw new Error(`recognition_class_count_mismatch:${enabledCatalog.length}:expected:${EXPECTED_RECOGNITION_CLASSES}`);
}

export const enabledBySlug = new Map(enabledCatalog.map((item) => [item.slug, item]));

export function publicCatalog() {
  return enabledCatalog.map(({ slug, displayName, category, ingredients, referenceImages, confidenceTier, availabilityStatus }) => ({
    pizzaId: slug,
    pizzaName: displayName,
    category,
    ingredients: ingredients ?? [],
    referenceImage: referenceImages[0] ?? null,
    confidenceTier,
    availabilityStatus: availabilityStatus ?? "current_listed_unverified"
  }));
}
