import type { MealSlot } from "@/lib/planner";

import type { RecipeLinkRecord } from "./types";

const KEY = "natassha-weekly-recipe-links-v1";
const BLOCKED_PROTOCOL = /^(?:javascript|data|file):/i;

export function buildTikTokRecipeSearchUrl(mealName: string): string {
  return `https://www.tiktok.com/search?q=${encodeURIComponent(`${mealName} resep diet simple Indonesia`)}`;
}

export function validateRecipeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || BLOCKED_PROTOCOL.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

function readAll(): RecipeLinkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is RecipeLinkRecord => Boolean(item && typeof item === "object" && typeof (item as RecipeLinkRecord).url === "string"))
      : [];
  } catch {
    return [];
  }
}

export function readRecipeLink(userId: string, date: string, slot: MealSlot): RecipeLinkRecord | null {
  const found = readAll().find((item) => item.userId === userId && item.date === date && item.slot === slot);
  return found ? { ...found } : null;
}

export function saveRecipeLink(record: RecipeLinkRecord): void {
  if (typeof window === "undefined") return;
  const remaining = readAll().filter((item) => !(item.userId === record.userId && item.date === record.date && item.slot === record.slot));
  window.localStorage.setItem(KEY, JSON.stringify([...remaining, { ...record }]));
}
