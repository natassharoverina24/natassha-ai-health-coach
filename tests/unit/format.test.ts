import {
  clampPercent,
  formatCalories,
  formatDateLabel,
  formatDelta,
  formatGrams,
  formatMilliliters,
  formatPercent,
  formatTimeLabel,
  formatWeightKg,
  greetingForHour,
  inferMealTypeForHour,
} from "@/lib/utils/format";

describe("formatWeightKg", () => {
  it("formats with one decimal by default", () => {
    expect(formatWeightKg(70.456)).toBe("70.5 kg");
  });

  it("respects a custom fraction digit count", () => {
    expect(formatWeightKg(70.456, 2)).toBe("70.46 kg");
  });
});

describe("formatDelta", () => {
  it("prefixes positive deltas with a plus sign", () => {
    expect(formatDelta(0.4)).toBe("+0.4 kg");
  });

  it("keeps the native minus sign for negative deltas", () => {
    expect(formatDelta(-0.4)).toBe("-0.4 kg");
  });

  it("shows zero without a sign", () => {
    expect(formatDelta(0)).toBe("0.0 kg");
  });
});

describe("formatCalories", () => {
  it("rounds to the nearest whole calorie and uses id-ID thousands separators", () => {
    // Math.round(1234.6) = 1235 -> "1.235" under the id-ID locale (period as thousands separator)
    expect(formatCalories(1234.6)).toBe("1.235 kcal");
  });

  it("rounds fractional calories under .5 down", () => {
    expect(formatCalories(500.2)).toBe("500 kcal");
  });
});

describe("formatGrams", () => {
  it("rounds and appends g", () => {
    expect(formatGrams(45.6)).toBe("46 g");
  });
});

describe("formatPercent", () => {
  it("formats with zero decimals by default", () => {
    expect(formatPercent(42.6)).toBe("43%");
  });

  it("supports custom decimal precision", () => {
    expect(formatPercent(42.678, 1)).toBe("42.7%");
  });
});

describe("formatMilliliters", () => {
  it("keeps small volumes in ml", () => {
    expect(formatMilliliters(500)).toBe("500 ml");
  });

  it("converts volumes >= 1000ml to liters", () => {
    expect(formatMilliliters(1500)).toBe("1.5 L");
  });
});

describe("clampPercent", () => {
  it("clamps below zero up to zero", () => {
    expect(clampPercent(-10)).toBe(0);
  });

  it("clamps above 100 down to 100", () => {
    expect(clampPercent(150)).toBe(100);
  });

  it("passes through in-range values", () => {
    expect(clampPercent(42)).toBe(42);
  });

  it("treats NaN as zero", () => {
    expect(clampPercent(NaN)).toBe(0);
  });
});

describe("formatDateLabel", () => {
  it("formats an ISO date as day-month-year", () => {
    expect(formatDateLabel("2026-07-25")).toBe("25 Jul 2026");
  });

  it("returns the original string when the date is invalid", () => {
    expect(formatDateLabel("not-a-date")).toBe("not-a-date");
  });
});

describe("greetingForHour", () => {
  it("greets morning hours", () => {
    expect(greetingForHour(8)).toBe("Good morning");
  });

  it("greets afternoon hours", () => {
    expect(greetingForHour(13)).toBe("Good afternoon");
  });

  it("greets evening hours", () => {
    expect(greetingForHour(17)).toBe("Good evening");
  });

  it("greets night hours", () => {
    expect(greetingForHour(22)).toBe("Good night");
  });
});

describe("formatTimeLabel", () => {
  it("formats an ISO timestamp as a locale time", () => {
    // 2026-07-25T08:32:00.000Z is a fixed instant; format it and just check
    // the shape rather than a specific timezone-dependent hour.
    const label = formatTimeLabel("2026-07-25T08:32:00.000Z");
    expect(label).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
  });

  it("returns the original string when the timestamp is invalid", () => {
    expect(formatTimeLabel("not-a-timestamp")).toBe("not-a-timestamp");
  });
});

describe("inferMealTypeForHour", () => {
  it("infers breakfast before 10am", () => {
    expect(inferMealTypeForHour(7)).toBe("breakfast");
    expect(inferMealTypeForHour(9)).toBe("breakfast");
  });

  it("infers lunch from 10am up to 3pm", () => {
    expect(inferMealTypeForHour(10)).toBe("lunch");
    expect(inferMealTypeForHour(14)).toBe("lunch");
  });

  it("infers dinner from 3pm up to 9pm", () => {
    expect(inferMealTypeForHour(15)).toBe("dinner");
    expect(inferMealTypeForHour(20)).toBe("dinner");
  });

  it("infers snack from 9pm onward", () => {
    expect(inferMealTypeForHour(21)).toBe("snack");
    expect(inferMealTypeForHour(23)).toBe("snack");
  });
});
