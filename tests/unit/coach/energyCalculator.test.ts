import {
  calculateEnergy,
  type EnergyCalculatorInput,
} from "@/lib/coach/energyCalculator";

const BASE_INPUT: EnergyCalculatorInput = {
  weightKg: 65,
  heightCm: 160,
  age: 30,
  sex: "female",
  activityLevel: "light",
};

describe("calculateEnergy", () => {
  it("calculates female BMR and TDEE with Mifflin-St Jeor", () => {
    expect(calculateEnergy(BASE_INPUT)).toEqual({
      status: "success",
      bmrCalories: 1339,
      tdeeCalories: 1841,
      activityLevel: "light",
      activityFactor: 1.375,
      formula: "mifflin-st-jeor",
      informationalOnly: true,
    });
  });

  it("calculates male BMR and TDEE with Mifflin-St Jeor", () => {
    expect(
      calculateEnergy({
        weightKg: 80,
        heightCm: 175,
        age: 35,
        sex: "male",
        activityLevel: "light",
      }),
    ).toEqual({
      status: "success",
      bmrCalories: 1724,
      tdeeCalories: 2370,
      activityLevel: "light",
      activityFactor: 1.375,
      formula: "mifflin-st-jeor",
      informationalOnly: true,
    });
  });

  it.each([
    ["sedentary", 1.2, 1607],
    ["light", 1.375, 1841],
    ["moderate", 1.55, 2075],
    ["active", 1.725, 2310],
    ["very-active", 1.9, 2544],
  ] as const)(
    "uses the %s activity factor",
    (activityLevel, activityFactor, tdeeCalories) => {
      expect(calculateEnergy({ ...BASE_INPUT, activityLevel })).toMatchObject({
        status: "success",
        activityLevel,
        activityFactor,
        tdeeCalories,
      });
    },
  );

  it("rounds BMR and TDEE independently to the nearest whole calorie", () => {
    expect(
      calculateEnergy({
        weightKg: 70.05,
        heightCm: 170,
        age: 31,
        sex: "male",
        activityLevel: "sedentary",
      }),
    ).toMatchObject({
      status: "success",
      bmrCalories: 1613,
      tdeeCalories: 1936,
    });
  });

  it.each(["weightKg", "heightCm", "age", "sex", "activityLevel"] as const)(
    "rejects a missing %s value",
    (field) => {
      const input = { ...BASE_INPUT } as Record<string, unknown>;
      delete input[field];
      expect(calculateEnergy(input as unknown as EnergyCalculatorInput)).toEqual({
        status: "invalid-input",
        errors: [`${field}.missing`],
      });
    },
  );

  it.each(["weightKg", "heightCm", "age"] as const)(
    "rejects zero and negative %s values",
    (field) => {
      expect(calculateEnergy({ ...BASE_INPUT, [field]: 0 })).toEqual({
        status: "invalid-input",
        errors: [`${field}.must-be-positive`],
      });
      expect(calculateEnergy({ ...BASE_INPUT, [field]: -1 })).toEqual({
        status: "invalid-input",
        errors: [`${field}.must-be-positive`],
      });
    },
  );

  it.each(["weightKg", "heightCm", "age"] as const)(
    "rejects NaN and infinite %s values",
    (field) => {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(calculateEnergy({ ...BASE_INPUT, [field]: value })).toEqual({
          status: "invalid-input",
          errors: [`${field}.not-finite`],
        });
      }
    },
  );

  it("rejects unsupported sex and activity-level runtime values", () => {
    expect(
      calculateEnergy({
        ...BASE_INPUT,
        sex: "unsupported",
      } as unknown as EnergyCalculatorInput),
    ).toEqual({
      status: "invalid-input",
      errors: ["sex.unsupported"],
    });

    expect(
      calculateEnergy({
        ...BASE_INPUT,
        activityLevel: "unsupported",
      } as unknown as EnergyCalculatorInput),
    ).toEqual({
      status: "invalid-input",
      errors: ["activityLevel.unsupported"],
    });
  });

  it("returns field errors in deterministic contract order", () => {
    expect(calculateEnergy({} as EnergyCalculatorInput)).toEqual({
      status: "invalid-input",
      errors: [
        "weightKg.missing",
        "heightCm.missing",
        "age.missing",
        "sex.missing",
        "activityLevel.missing",
      ],
    });
  });

  it("returns the same output for the same input", () => {
    expect(calculateEnergy(BASE_INPUT)).toEqual(calculateEnergy(BASE_INPUT));
  });

  it("does not mutate its input", () => {
    const input = Object.freeze({ ...BASE_INPUT });
    const snapshot = { ...input };
    calculateEnergy(input);
    expect(input).toEqual(snapshot);
  });

  it("returns no recommendation, target, thyroid, or medical fields", () => {
    const result = calculateEnergy(BASE_INPUT);
    expect(result).toEqual(
      expect.not.objectContaining({
        calorieTarget: expect.anything(),
        recommendedCalories: expect.anything(),
        recommendation: expect.anything(),
        rationale: expect.anything(),
        thyroid: expect.anything(),
        medicalAdvice: expect.anything(),
      }),
    );
  });
});
