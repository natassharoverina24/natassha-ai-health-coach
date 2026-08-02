import {
  buildSupplementTimingCopy,
  inferSupplementSuggestedTiming,
  normalizeSupplementName,
} from "@/lib/supplements";

describe("supplement timing suggestions", () => {
  it.each(["Vitamin D", "Vitamin D3", "D3", "cholecalciferol"])(
    "suggests a meal-time morning schedule for %s",
    (name) => {
      const result = inferSupplementSuggestedTiming(name);

      expect(result).toMatchObject({
        suggestedTimeOfDay: "morning-or-lunch",
        suggestedTime: "08:00",
        confidence: "medium",
        userCanOverride: true,
      });
      expect(result.reason).toMatch(/bareng makan/i);
      expect(result.copy).toMatch(/pagi\/siang/i);
    },
  );

  it("suggests evening for magnesium citrate", () => {
    const result = inferSupplementSuggestedTiming("Magnesium citrate");

    expect(result).toMatchObject({
      suggestedTimeOfDay: "evening-or-night",
      suggestedTime: "20:00",
      confidence: "medium",
    });
    expect(result.copy).toMatch(/malam/i);
  });

  it("keeps generic timing tentative and user-editable", () => {
    const result = inferSupplementSuggestedTiming("Supplement tersimpan");

    expect(result).toMatchObject({
      suggestedTimeOfDay: "morning",
      confidence: "low",
      userCanOverride: true,
    });
    expect(result.copy).toMatch(/bisa ubah/i);
    expect(buildSupplementTimingCopy(result)).toMatch(/saran waktu umum/i);
  });

  it("always preserves a valid user-selected time", () => {
    const result = inferSupplementSuggestedTiming("Vitamin D3", "14:35");

    expect(result).toMatchObject({
      suggestedTimeOfDay: "user-selected",
      suggestedTime: "14:35",
    });
    expect(result.copy).toBe("Aku pakai jadwal yang kamu pilih ya.");
  });

  it("normalizes names deterministically without dosage or treatment advice", () => {
    expect(normalizeSupplementName("  Vitamin-D3™  ")).toBe("vitamin d3tm");
    const output = JSON.stringify([
      inferSupplementSuggestedTiming("Vitamin D3"),
      inferSupplementSuggestedTiming("Magnesium citrate"),
      inferSupplementSuggestedTiming("Lainnya"),
    ]);

    expect(output).not.toMatch(/\b\d+\s*(mg|mcg|iu)\b/i);
    expect(output).not.toMatch(/menyembuhkan|mencegah|mengobati|terapi thyroid|terapi migraine|terapi pms/i);
  });
});
