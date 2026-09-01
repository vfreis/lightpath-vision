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
  notes: z.string().optional()
});

const CatalogSchema = z.array(MenuItemSchema).min(1);
export type MenuItem = z.infer<typeof MenuItemSchema>;

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
  const version = `sha256:${createHash("sha256").update(rawText).digest("hex").slice(0, 12)}`;
  return { items: parsed, sourcePath: path, version };
}

const loaded = loadCatalog();
export const catalog = loaded.items;
export const catalogSourcePath = loaded.sourcePath;
export const catalogVersion = loaded.version;
export const enabledCatalog = catalog.filter((item) => item.recognitionEnabled);
export const enabledBySlug = new Map(enabledCatalog.map((item) => [item.slug, item]));

export function publicCatalog() {
  return enabledCatalog.map(({ slug, displayName, category, ingredients, referenceImages, confidenceTier }) => ({
    pizzaId: slug,
    pizzaName: displayName,
    category,
    ingredients: ingredients ?? [],
    referenceImage: referenceImages[0] ?? null,
    confidenceTier
  }));
}
