"use client";

import { useEffect, useMemo, useState } from "react";

import { AutoShoppingList } from "@/components/shopping";
import { Button } from "@/components/ui/Button";
import { getTemplatePracticalFoods } from "@/lib/meal-substitutions";
import type { MealSlot, WeeklyMealPrepDay } from "@/lib/planner";
import {
  buildShoppingListFromMealPlan,
  readMealReplacementSelections,
  saveMealReplacementSelection,
  type SelectedMealReplacement,
} from "@/lib/shopping-list";
import {
  buildTikTokRecipeSearchUrl,
  getLocalMealIdeaAlternatives,
  readRecipeLink,
  readWeeklyMealPreferences,
  requestAiWeeklyMealIdea,
  saveRecipeLink,
  saveWeeklyMealPreferences,
  validateRecipeUrl,
  type PracticalMealIdea,
  type RecipeLinkRecord,
  type WeeklyMealPreferences,
} from "@/lib/weekly-meal-ideas";

const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
const EMPTY_PREFERENCES: WeeklyMealPreferences = { likedFoodIds: [], dislikedFoodIds: [], quickMealsPreferred: false };
function mealKey(date: string, slot: MealSlot) { return `${date}:${slot}`; }
function slotLabel(slot: MealSlot) {
  return { breakfast: "Sarapan", lunch: "Makan siang", snack: "Snack", dinner: "Makan malam" }[slot];
}
function providerLabel(idea: PracticalMealIdea) {
  if (idea.provenance !== "ai-assisted") return "Katalog lokal";
  const provider = idea.provider === "openrouter" ? "OpenRouter Free" : idea.provider === "groq" ? "Groq" : "Gemini";
  return `Dibantu AI gratis · ${provider}`;
}

export function WeeklyMealPlanExperience({ days, userId }: { days: readonly WeeklyMealPrepDay[]; userId: string | null }) {
  const storageUserId = userId ?? "local-user";
  const [selections, setSelections] = useState<SelectedMealReplacement[]>([]);
  const [ideas, setIdeas] = useState<Record<string, PracticalMealIdea>>({});
  const [preferences, setPreferences] = useState<WeeklyMealPreferences>(EMPTY_PREFERENCES);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, RecipeLinkRecord>>({});
  const [recipeEditKey, setRecipeEditKey] = useState<string | null>(null);
  const [recipeDraft, setRecipeDraft] = useState("");
  const [recipeError, setRecipeError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelections(readMealReplacementSelections(storageUserId));
      setPreferences(readWeeklyMealPreferences(storageUserId));
      const links: Record<string, RecipeLinkRecord> = {};
      for (const day of days) for (const slot of SLOTS) {
        const link = readRecipeLink(storageUserId, day.date, slot);
        if (link) links[mealKey(day.date, slot)] = link;
      }
      setRecipeLinks(links);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [days, storageUserId]);

  const shoppingResult = useMemo(() => buildShoppingListFromMealPlan({ days, selectedReplacements: selections }), [days, selections]);

  function chooseIdea(date: string, slot: MealSlot, idea: PracticalMealIdea) {
    const selection: SelectedMealReplacement = {
      userId: storageUserId,
      date,
      slot,
      templateId: idea.id,
      label: idea.name,
      selectedAt: new Date().toISOString(),
      ingredientIds: [...idea.ingredientIds],
      provenance: idea.provenance,
      provider: idea.provider,
      model: idea.model,
    };
    saveMealReplacementSelection(selection);
    setSelections((current) => [...current.filter((item) => !(item.date === date && item.slot === slot)), selection]);
    setIdeas((current) => ({ ...current, [mealKey(date, slot)]: idea }));
    setOpenKey(null);
  }

  function updatePreference(ids: readonly string[], kind: "like" | "dislike") {
    const next: WeeklyMealPreferences = {
      ...preferences,
      likedFoodIds: kind === "like" ? [...new Set([...preferences.likedFoodIds, ...ids])] : preferences.likedFoodIds.filter((id) => !ids.includes(id)),
      dislikedFoodIds: kind === "dislike" ? [...new Set([...preferences.dislikedFoodIds, ...ids])] : preferences.dislikedFoodIds.filter((id) => !ids.includes(id)),
    };
    saveWeeklyMealPreferences(storageUserId, next);
    setPreferences(next);
    setNotice(kind === "like" ? "Aku catat menu yang kamu suka 💗" : "Oke, aku hindari bahan ini kalau ada alternatif.");
  }

  async function askAi(date: string, slot: MealSlot, currentMealName: string) {
    const key = mealKey(date, slot);
    setLoadingKey(key);
    setNotice(null);
    const result = await requestAiWeeklyMealIdea({ slot, currentMealName, ...preferences });
    setLoadingKey(null);
    if (result.status === "success") {
      setIdeas((current) => ({ ...current, [key]: result.idea }));
      setNotice("Aku nemu satu variasi praktis. Cek dulu sebelum dipilih ya 💗");
      return;
    }
    setNotice("Kalau AI lagi limit, aku pakai katalog lokal dulu.");
  }

  function submitRecipe(event: React.FormEvent, date: string, slot: MealSlot) {
    event.preventDefault();
    const url = validateRecipeUrl(recipeDraft);
    if (!url) {
      setRecipeError("Linknya belum valid. Coba pakai link https yang lengkap ya.");
      return;
    }
    const record = { userId: storageUserId, date, slot, url, savedAt: new Date().toISOString() };
    saveRecipeLink(record);
    setRecipeLinks((current) => ({ ...current, [mealKey(date, slot)]: record }));
    setRecipeEditKey(null);
    setRecipeDraft("");
    setRecipeError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-control bg-petal-soft px-4 py-3 text-sm text-ink">
        <p className="font-semibold">Aku bikin variasi biar nggak bosen ya 💗</p>
        <p className="mt-1 text-ink-muted">Pilih yang paling gampang kamu dapetin hari ini. AI hanya bantu ide nama menu; angka nutrisi tetap harus dari sumber yang dikonfirmasi.</p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.quickMealsPreferred}
            onChange={(event) => {
              const next = { ...preferences, quickMealsPreferred: event.target.checked };
              saveWeeklyMealPreferences(storageUserId, next);
              setPreferences(next);
            }}
          />
          Prioritaskan menu cepat dan gampang
        </label>
      </div>
      {notice && <p role="status" className="rounded-control bg-blush px-3 py-2 text-sm text-ink">{notice}</p>}
      <ol aria-label="Seven-day meal plan" className="grid gap-3">
        {days.map((day) => (
          <li key={day.date} className="rounded-control border border-rose/15 bg-white p-3">
            <h4 className="text-sm font-semibold text-ink">{day.date}</h4>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {SLOTS.map((slot) => {
                const key = mealKey(day.date, slot);
                const planned = day.mealPlan[slot];
                const selected = selections.find((item) => item.date === day.date && item.slot === slot);
                const selectedIdea = ideas[key];
                const displayName = selected?.label ?? planned.template.name;
                const displayIdea = selectedIdea?.name === displayName ? selectedIdea : null;
                const ingredientIds = displayIdea?.ingredientIds ?? getTemplatePracticalFoods(selected?.templateId ?? planned.template.id).map((food) => food.id);
                const alternatives = getLocalMealIdeaAlternatives(slot, selected?.templateId ?? planned.template.id, preferences).slice(0, 3);
                const customAiIdea = ideas[key]?.provenance === "ai-assisted" ? ideas[key] : null;
                const recipe = recipeLinks[key];
                return (
                  <li key={slot} className="min-w-0 rounded-control bg-petal-soft/60 px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-rose-strong">{slotLabel(slot)}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{displayName}</p>
                    <p className="mt-1 text-xs text-ink-muted">{displayIdea?.reason ?? planned.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-full bg-white px-2 py-1 text-rose-strong">
                        {displayIdea
                          ? providerLabel(displayIdea)
                          : selected?.provenance === "ai-assisted"
                            ? `Dibantu AI gratis · ${selected.provider === "openrouter" ? "OpenRouter Free" : selected.provider === "groq" ? "Groq" : "Gemini"}`
                            : "Katalog lokal"}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-ink-muted">{displayIdea?.availability === "optional" ? "Cek ketersediaan" : "Gampang dicari di Indonesia"}</span>
                      {selected && <span className="rounded-full bg-white px-2 py-1 text-ink-muted">Nutrisi perlu konfirmasi</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setOpenKey(openKey === key ? null : key)}>Ganti menu</Button>
                      {recipe ? (
                        <>
                          <a className="inline-flex h-9 items-center rounded-control px-3 text-sm font-semibold text-rose-strong underline" href={recipe.url} target="_blank" rel="noreferrer">Lihat resep</a>
                          <Button size="sm" variant="ghost" onClick={() => { setRecipeEditKey(key); setRecipeDraft(recipe.url); }}>Ganti link</Button>
                        </>
                      ) : (
                        <>
                          <a className="inline-flex h-9 items-center rounded-control px-3 text-sm font-semibold text-rose-strong underline" href={buildTikTokRecipeSearchUrl(displayName)} target="_blank" rel="noreferrer">Cari resep di TikTok</a>
                          <Button size="sm" variant="ghost" onClick={() => { setRecipeEditKey(key); setRecipeDraft(""); }}>Tambah link resep</Button>
                        </>
                      )}
                    </div>
                    {openKey === key && (
                      <div className="mt-3 rounded-control border border-rose/15 bg-white p-3">
                        <p className="text-xs text-ink-muted">Nggak ada menu ini? Pilih alternatif lokal atau minta satu ide AI gratis.</p>
                        <div className="mt-2 grid gap-2">
                          {alternatives.map((idea) => <button key={idea.id} type="button" className="rounded-control border border-rose/20 px-3 py-2 text-left text-sm text-ink hover:bg-petal-soft" onClick={() => chooseIdea(day.date, slot, idea)}>{idea.name}<span className="block text-xs text-ink-muted">Katalog lokal · nutrisi perlu konfirmasi</span></button>)}
                          {customAiIdea && <button type="button" className="rounded-control border border-rose/20 px-3 py-2 text-left text-sm text-ink hover:bg-petal-soft" onClick={() => chooseIdea(day.date, slot, customAiIdea)}>{customAiIdea.name}<span className="block text-xs text-ink-muted">{providerLabel(customAiIdea)} · Nutrisi perlu konfirmasi</span></button>}
                          <Button size="sm" variant="outline" isLoading={loadingKey === key} onClick={() => askAi(day.date, slot, displayName)}>Cari variasi dengan AI gratis</Button>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => updatePreference(ingredientIds, "like")}>Aku suka ini</Button>
                          <Button size="sm" variant="ghost" onClick={() => updatePreference(ingredientIds, "dislike")}>Kurangi menu ini</Button>
                        </div>
                      </div>
                    )}
                    {recipeEditKey === key && (
                      <form className="mt-3 grid gap-2" onSubmit={(event) => submitRecipe(event, day.date, slot)}>
                        <label className="text-xs font-semibold text-ink" htmlFor={`recipe-${key}`}>Tambah link resep favoritmu 💗</label>
                        <input id={`recipe-${key}`} name={`recipe-${key}`} className="h-10 rounded-control border border-rose/20 px-3 text-sm" value={recipeDraft} onChange={(event) => setRecipeDraft(event.target.value)} placeholder="https://..." />
                        {recipeError && <p role="alert" className="text-xs text-danger">{recipeError}</p>}
                        <p className="text-xs text-ink-muted">Link ini opsional, meal plan tetap jalan kok.</p>
                        <Button size="sm" type="submit">Simpan link</Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      <AutoShoppingList result={shoppingResult} />
    </div>
  );
}
