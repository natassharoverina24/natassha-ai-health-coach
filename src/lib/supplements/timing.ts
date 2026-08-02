import type { SupplementTimingSuggestion } from "./types";

const CAUTION =
  "Ini saran waktu umum, bukan instruksi medis. Kalau kamu lagi minum obat/resep dokter, cek lagi dengan tenaga kesehatan ya.";

export function normalizeSupplementName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isClock(value: string | null | undefined): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function inferSupplementSuggestedTiming(
  name: string,
  userSelectedTime?: string | null,
): SupplementTimingSuggestion {
  if (isClock(userSelectedTime)) {
    return {
      suggestedTimeOfDay: "user-selected",
      suggestedTime: userSelectedTime,
      reason: "jadwal pilihanmu selalu diprioritaskan",
      copy: "Aku pakai jadwal yang kamu pilih ya.",
      caution: CAUTION,
      confidence: "medium",
      userCanOverride: true,
    };
  }

  const normalized = normalizeSupplementName(name);
  const isVitaminD =
    /^(d3|vitamin d|vitamin d3|cholecalciferol)$/.test(normalized) ||
    /\b(vitamin d3?|cholecalciferol)\b/.test(normalized);

  if (isVitaminD) {
    return {
      suggestedTimeOfDay: "morning-or-lunch",
      suggestedTime: "08:00",
      reason: "lebih enak diminum bareng makan",
      copy: "D3 biasanya lebih nyaman diminum bareng makan. Aku taruh pagi/siang dulu ya 💗",
      caution: CAUTION,
      confidence: "medium",
      userCanOverride: true,
    };
  }

  if (/\bmagnesium citrate\b/.test(normalized)) {
    return {
      suggestedTimeOfDay: "evening-or-night",
      suggestedTime: "20:00",
      reason: "sering dipilih malam untuk rutinitas santai",
      copy: "Magnesium citrate aku taruh malam dulu ya. Kalau kurang cocok di perut, kamu bisa pindah ke pagi/siang.",
      caution: CAUTION,
      confidence: "medium",
      userCanOverride: true,
    };
  }

  if (/\bmagnesium\b/.test(normalized)) {
    return {
      suggestedTimeOfDay: "evening-or-night",
      suggestedTime: "20:00",
      reason: "saran waktu umum yang bisa kamu ubah",
      copy: "Aku taruh malam dulu sebagai jadwal umum. Kamu tetap bisa pindahkan sesuai rutinitasmu.",
      caution: CAUTION,
      confidence: "low",
      userCanOverride: true,
    };
  }

  return {
    suggestedTimeOfDay: "morning",
    suggestedTime: "08:00",
    reason: "jadwal awal yang bisa kamu sesuaikan",
    copy: "Aku pakai jadwal pagi dulu ya. Kamu bisa ubah sesuai rutinitasmu.",
    caution: CAUTION,
    confidence: "low",
    userCanOverride: true,
  };
}

export function buildSupplementTimingCopy(
  suggestion: SupplementTimingSuggestion,
): string {
  return `${suggestion.copy} ${suggestion.caution}`;
}
