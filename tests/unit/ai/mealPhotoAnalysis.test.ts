import {
  buildConfirmedMealUpdate,
  type ConfirmedMealPhotoEstimate,
} from "@/lib/ai/mealPhotoAnalysis";

describe("confirmed meal-photo estimates", () => {
  it("persists only corrected structured values and minimal provenance", () => {
    const estimate: ConfirmedMealPhotoEstimate = {
      foodName: "Corrected food",
      portion: "1 corrected bowl",
      calories: 480,
      proteinG: 28,
      source: "photo-estimate",
      userConfirmed: true,
      estimatedAt: "2026-07-28T02:00:00.000Z",
    };

    const update = buildConfirmedMealUpdate(
      {
        calories: 100,
        proteinG: 5,
        carbsG: 42,
        fatG: 8,
        fiberG: 4,
      },
      estimate,
    );

    expect(update).toEqual({
      name: "Corrected food",
      quantity: "1 corrected bowl",
      macros: {
        calories: 480,
        proteinG: 28,
        carbsG: 42,
        fatG: 8,
        fiberG: 4,
      },
      photoEstimate: {
        source: "photo-estimate",
        userConfirmed: true,
        estimatedAt: "2026-07-28T02:00:00.000Z",
      },
    });
    const serialized = JSON.stringify(update);
    expect(serialized).not.toMatch(
      /image|base64|downloadURL|storagePath|providerPayload/,
    );
  });
});
