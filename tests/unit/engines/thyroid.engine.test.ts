import { runThyroidEngine } from "@/lib/engines/thyroid.engine";

describe("runThyroidEngine — avoid aggressive deficits", () => {
  it("flags a deficit steeper than 25% below maintenance", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1400,
      estimatedMaintenanceCalories: 2000, // 1400/2000 = 0.70 -> 30% deficit
      recentReportedSymptoms: [],
    });
    const deficit = insights.find((i) => i.id === "thyroid.deficit_too_aggressive");
    expect(deficit).toBeDefined();
    expect(deficit?.suppresses).toContain("nutrition");
    expect(deficit?.data?.deficitPercent).toBe(30);
  });

  it("does not flag a moderate deficit", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1700,
      estimatedMaintenanceCalories: 2000, // 15% deficit
      recentReportedSymptoms: [],
    });
    expect(insights.some((i) => i.id === "thyroid.deficit_too_aggressive")).toBe(false);
  });

  it("skips the deficit check when maintenance calories can't be estimated", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1000,
      estimatedMaintenanceCalories: null,
      recentReportedSymptoms: [],
    });
    expect(insights.some((i) => i.id === "thyroid.deficit_too_aggressive")).toBe(false);
  });
});

describe("runThyroidEngine — symptom-aware, recommend medical follow-up", () => {
  it("flags recent thyroid-related symptoms and points to a doctor, not a diagnosis", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1400,
      estimatedMaintenanceCalories: null,
      recentReportedSymptoms: ["persistent fatigue", "hair loss"],
    });
    const followUp = insights.find((i) => i.id === "thyroid.symptom_follow_up");
    expect(followUp).toBeDefined();
    expect(followUp?.recommendedAction).toMatch(/doctor/i);
    // The engine explicitly disclaims giving supplement advice — that disclaimer
    // legitimately contains the word "supplement", which is the desired behavior.
    expect(followUp?.recommendedAction).toMatch(/doesn't diagnose or recommend supplements/i);
  });

  it("does not flag unrelated symptoms", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1400,
      estimatedMaintenanceCalories: null,
      recentReportedSymptoms: ["ankle sprain"],
    });
    expect(insights.some((i) => i.id === "thyroid.symptom_follow_up")).toBe(false);
  });

  it("never names a specific supplement, vitamin, or thyroid-diet protocol in any insight", () => {
    const insights = runThyroidEngine({
      calorieGoal: 1000,
      estimatedMaintenanceCalories: 2000,
      recentReportedSymptoms: ["fatigue", "cold intolerance"],
    });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      // No specific supplement/vitamin/mineral name and no named "thyroid diet" —
      // the disclaiming phrase "recommend supplements" (a negation) is fine and expected.
      expect(insight.recommendedAction.toLowerCase()).not.toMatch(/\b(iodine|selenium|levothyroxine)\b/);
      expect(insight.recommendedAction.toLowerCase()).not.toMatch(/take a? ?(supplement|vitamin)/);
      expect(insight.summary.toLowerCase()).not.toMatch(/thyroid diet/);
    }
  });
});
