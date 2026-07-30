import {
  findApprovedNutritionEstimate,
  requestManualNutritionEstimate,
} from "@/lib/ai/manualNutritionEstimate";

const geminiEstimate = {
  source: "gemini-estimate",
  servingGrams: 350,
  macros: {
    calories: 320,
    proteinG: 22,
    carbsG: 35,
    fatG: 10,
  },
  assumptions: ["One medium bowl was assumed."],
  confidence: "low",
  uncertain: true,
  estimatedAt: "2026-07-30T08:00:00.000Z",
};

describe("manual nutrition estimation", () => {
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
        macros: { calories: 200, proteinG: 4, carbsG: 44, fatG: 0.4 },
      },
    });
    expect(fetcher).not.toHaveBeenCalled();
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
