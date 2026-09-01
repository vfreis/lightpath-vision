import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MenuItem } from "./catalog.js";

export const PROMPT_VERSION = "pizza-classifier.v1";

let cachedPrompt: string | null = null;

function loadPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  const candidates = [
    resolve(process.cwd(), "prompts/pizza-classifier.v1.md"),
    resolve(process.cwd(), "api/prompts/pizza-classifier.v1.md")
  ];
  const path = candidates.find((candidate) => {
    try {
      readFileSync(candidate, "utf8");
      return true;
    } catch {
      return false;
    }
  });
  if (!path) throw new Error("prompt_not_found");
  cachedPrompt = readFileSync(path, "utf8");
  return cachedPrompt;
}

export function buildSystemPrompt(items: MenuItem[]): string {
  const allowed = items.map((item) => ({
    pizzaId: item.slug,
    pizzaName: item.displayName,
    aliases: item.aliases,
    category: item.category,
    ingredients: item.ingredients ?? []
  }));

  return `${loadPrompt()}\n\n## Catálogo permitido nesta requisição\n${JSON.stringify(allowed, null, 2)}`;
}
