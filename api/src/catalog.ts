import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import type { ProductFamily } from "./schemas.js";

const CatalogFamilySchema = z.enum(["pizza", "calzone", "dolci", "other"]);

const MenuItemSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  family: CatalogFamilySchema.optional(),
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
const DomainOverlaySchema = z.object({
  version: z.string().min(1),
  dropSlugs: z.array(z.string()).default([]),
  renameSlugs: z.record(z.string(), z.string()).default({}),
  familyOverrides: z.record(z.string(), CatalogFamilySchema).default({}),
  addItems: z.array(MenuItemSchema).default([])
});
type ParsedMenuItem = z.infer<typeof MenuItemSchema>;
export type MenuItem = Omit<ParsedMenuItem, "family"> & { family: Exclude<ProductFamily, "inconclusive"> };

function inferFamily(item: ParsedMenuItem): MenuItem["family"] {
  if (item.family) return item.family;
  const category = item.category.toLocaleLowerCase("pt-BR");
  if (category.includes("calzone")) return "calzone";
  if (category.includes("doce") || category.includes("dolci") || category.includes("dessert") || category.includes("sobremesa")) return "dolci";
  if (category.includes("pizza")) return "pizza";
  return "other";
}

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

function domainOverlayPaths(): string[] {
  return [
    resolve(process.cwd(), "data/catalog-domain-41.v1.json"),
    resolve(process.cwd(), "../data/catalog-domain-41.v1.json")
  ];
}

function loadDomainOverlay(): { overlay: z.infer<typeof DomainOverlaySchema> | null; rawText: string } {
  const path = domainOverlayPaths().find((value) => existsSync(value));
  if (!path) return { overlay: null, rawText: "" };
  const rawText = readFileSync(path, "utf8");
  return { overlay: DomainOverlaySchema.parse(JSON.parse(rawText)), rawText };
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
  const parsedBase = CatalogSchema.parse(raw);
  const domain = loadDomainOverlay();
  const reverseRename = new Map(Object.entries(domain.overlay?.renameSlugs ?? {}).map(([from, to]) => [to, from]));
  const dropped = new Set(domain.overlay?.dropSlugs ?? []);
  const parsed = [
    ...parsedBase
      .filter((item) => !dropped.has(item.slug))
      .map((item) => {
        const slug = domain.overlay?.renameSlugs[item.slug] ?? item.slug;
        const family = domain.overlay?.familyOverrides[slug] ?? item.family;
        return { ...item, slug, family };
      }),
    ...(domain.overlay?.addItems ?? [])
  ];

  const slugs = new Set<string>();
  for (const item of parsed) {
    if (slugs.has(item.slug)) throw new Error(`duplicate_catalog_slug:${item.slug}`);
    slugs.add(item.slug);
  }

  const overlay = loadReferenceImages();
  const items: MenuItem[] = parsed.map((item) => {
    const legacySlug = reverseRename.get(item.slug);
    const verified = overlay.references[item.slug] ?? (legacySlug ? overlay.references[legacySlug] : undefined) ?? [];
    return {
      ...item,
      family: inferFamily(item),
      referenceImages: [...new Set([...item.referenceImages, ...verified])]
    };
  });

  const versionInput = [rawText, domain.rawText, overlay.rawText].filter(Boolean).join("\n");
  const version = `sha256:${createHash("sha256").update(versionInput).digest("hex").slice(0, 12)}`;
  return { items, sourcePath: path, version };
}

const loaded = loadCatalog();
export const catalog = loaded.items;
export const catalogSourcePath = loaded.sourcePath;
export const catalogVersion = loaded.version;
export const enabledCatalog = catalog.filter((item) => item.recognitionEnabled);
export const enabledBySlug = new Map(enabledCatalog.map((item) => [item.slug, item]));

export function enabledCatalogForFamily(family: ProductFamily): MenuItem[] {
  if (family === "inconclusive") return [];
  return enabledCatalog.filter((item) => item.family === family);
}

export function publicCatalog() {
  return enabledCatalog.map(({ slug, displayName, family, category, ingredients, referenceImages, confidenceTier, availabilityStatus }) => ({
    pizzaId: slug,
    pizzaName: displayName,
    family,
    category,
    ingredients: ingredients ?? [],
    referenceImage: referenceImages[0] ?? null,
    confidenceTier,
    availabilityStatus: availabilityStatus ?? "current_listed_unverified"
  }));
}
