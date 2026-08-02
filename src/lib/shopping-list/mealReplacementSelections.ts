import type { MealSlot } from "@/lib/planner";
import type { SelectedMealReplacement } from "./types";

const STORAGE_KEY = "natassha-meal-replacements-v1";
const MEAL_SLOTS = new Set<MealSlot>([
  "breakfast",
  "lunch",
  "snack",
  "dinner",
]);

function isSelection(value: unknown): value is SelectedMealReplacement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.userId === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) &&
    MEAL_SLOTS.has(item.slot as MealSlot) &&
    typeof item.templateId === "string" &&
    typeof item.label === "string" &&
    typeof item.selectedAt === "string"
  );
}

function readAll(): SelectedMealReplacement[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSelection) : [];
  } catch {
    return [];
  }
}

export function readMealReplacementSelections(
  userId: string,
): SelectedMealReplacement[] {
  return readAll()
    .filter((selection) => selection.userId === userId)
    .map((selection) => ({ ...selection }));
}

export function saveMealReplacementSelection(
  selection: SelectedMealReplacement,
): void {
  if (typeof window === "undefined") return;
  const remaining = readAll().filter(
    (item) =>
      !(
        item.userId === selection.userId &&
        item.date === selection.date &&
        item.slot === selection.slot
      ),
  );
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...remaining, { ...selection }]),
  );
}

export function clearMealReplacementSelection(
  userId: string,
  date: string,
  slot: MealSlot,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      readAll().filter(
        (item) =>
          !(
            item.userId === userId &&
            item.date === date &&
            item.slot === slot
          ),
      ),
    ),
  );
}
