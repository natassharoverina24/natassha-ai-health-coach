import {
  findApprovedNutritionEstimate,
  findUserConfirmedNutritionEstimate,
  requestManualNutritionEstimate,
} from "@/lib/ai/manualNutritionEstimate";
import type { MealEntry } from "@/types/firestore";

const geminiEstimate = {
  source: "gemini-estimate",
  provider: "gemini",
  model: "gemini-3.5-flash-lite",
  servingGrams: 350,
  macros: {
    calories: 320,
    proteinG: 22,
    carbsG: 35,
    fatG: 10,
    fiberG: 2,
  },
  assumptions: ["One medium bowl was assumed."],
  confidence: "low",
  uncertain: true,
  estimatedAt: "2026-07-30T08:00:00.000Z",
  metadata: {
    source: "gemini",
    providerLabel: "Estimated with Gemini",
    model: "gemini-3.5-flash-lite",
    estimatedAt: "2026-07-30T08:00:00.000Z",
    confidence: "low",
  },
};

const confirmedSoto: MealEntry = {
  id: "confirmed-soto",
  createdAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:05:00.000Z",
  userId: "user-1",
  date: "2026-07-29",
  type: "lunch",
  name: "Soto",
  quantity: "1 mangkok",
  isOfficeLunch: false,
  macros: {
    calories: 350,
    proteinG: 22,
    carbsG: 35,
    fatG: 10,
    fiberG: 2,
  },
  nutritionConfirmation: {
    status: "confirmed",
    source: "gemini-estimate",
    userConfirmed: true,
    servingGrams: 350,
    assumptions: [],
    estimatedAt: "2026-07-29T08:00:00.000Z",
    confirmedAt: "2026-07-29T08:05:00.000Z",
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
  },
  photoIds: [],
  score: null,
  note: null,
};

describe("manual nutrition estimation", () => {
  it("keeps every provider secret name out of the client module", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/lib/ai/manualNutritionEstimate.ts"),
      "utf8",
    );
    expect(clientSource).not.toMatch(
      /GEMINI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|process\.env/,
    );
  });

  it("uses the approved local source for a known item without Gemini", async () => {
    const fetcher = jest.fn();

    const result = await requestManualNutritionEstimate(
      { name: "Rice", quantity: "1 serving" },
      {
        fetcher,
        getIdToken: jest.fn(),
        now: () => "2026-07-30T08:00:00.000Z",
      },
    );

    expect(result).toMatchObject({
      status: "ready",
      estimate: {
        source: "local-approved",
        metadata: {
          source: "local",
          providerLabel: "From local food database",
        },
        macros: { calories: 200, proteinG: 4, carbsG: 44, fatG: 0.4 },
      },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses a user-confirmed food cache before any AI request", async () => {
    const fetcher = jest.fn();
    const getIdToken = jest.fn();
    const result = await requestManualNutritionEstimate(
      { name: "soto", quantity: "1 mangkok" },
      {
        getConfirmedMeals: async () => [confirmedSoto],
        fetcher,
        getIdToken,
      },
    );

    expect(
      findUserConfirmedNutritionEstimate(
        { name: "Soto", quantity: "1 mangkok" },
        [confirmedSoto],
      ),
    ).toMatchObject({
      source: "user-confirmed-cache",
      macros: { calories: 350, proteinG: 22, fiberG: 2 },
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
    });
    expect(result).toMatchObject({
      status: "ready",
      estimate: {
        source: "user-confirmed-cache",
        metadata: {
          source: "cache",
          providerLabel: "From your saved food cache",
        },
        macros: { calories: 350 },
      },
    });
    expect(getIdToken).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not cache a legacy meal without explicit user confirmation", () => {
    const legacyMeal = { ...confirmedSoto };
    delete legacyMeal.nutritionConfirmation;

    expect(
      findUserConfirmedNutritionEstimate(
        { name: "Soto", quantity: "1 mangkok" },
        [legacyMeal],
      ),
    ).toBeNull();
  });

  it("uses exactly one Gemini fallback request for an unknown item", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estimate: geminiEstimate }),
    });

    const result = await requestManualNutritionEstimate(
      { name: "Soto", quantity: "1 mangkok" },
      {
        fetcher,
        getIdToken: async () => "firebase-token",
      },
    );

    expect(findApprovedNutritionEstimate({ name: "Soto", quantity: null })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/ai/meal-nutrition",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-token",
        }),
      }),
    );
    expect(result).toEqual({ status: "ready", estimate: geminiEstimate });
  });

  it("rejects malformed Gemini output instead of accepting zero nutrition", async () => {
    const result = await requestManualNutritionEstimate(
      { name: "Unknown meal", quantity: null },
      {
        getIdToken: async () => "firebase-token",
        fetcher: jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            estimate: {
              ...geminiEstimate,
              macros: {
                calories: 0,
                proteinG: 0,
                carbsG: 0,
                fatG: 0,
              },
            },
          }),
        }),
      },
    );

    expect(result).toEqual({
      status: "unavailable",
      message: "Nutrition estimate unavailable",
    });
  });

  it.each([429, 500])(
    "returns the manual-entry fallback state for Gemini HTTP %s",
    async (status) => {
      const result = await requestManualNutritionEstimate(
        { name: "Unknown meal", quantity: null },
        {
          getIdToken: async () => "firebase-token",
          fetcher: jest.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => ({ error: "private provider detail" }),
          }),
        },
      );

      expect(result).toEqual({
        status: "unavailable",
        message: "Nutrition estimate unavailable",
      });
      expect(JSON.stringify(result)).not.toMatch(/provider|private/i);
    },
  );
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
