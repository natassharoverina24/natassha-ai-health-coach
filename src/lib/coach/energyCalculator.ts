/**
 * Informational Energy Calculator
 * ---------------------------------------------------------------------------
 * Pure Mifflin-St Jeor BMR and TDEE calculation in metric units. This module
 * does not recommend targets or connect its output to any coaching engine.
 */

export type EnergyCalculatorSex = "female" | "male";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very-active";

export interface EnergyCalculatorInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: EnergyCalculatorSex;
  activityLevel: ActivityLevel;
}

export type EnergyCalculatorErrorCode =
  | "weightKg.missing"
  | "weightKg.not-finite"
  | "weightKg.must-be-positive"
  | "heightCm.missing"
  | "heightCm.not-finite"
  | "heightCm.must-be-positive"
  | "age.missing"
  | "age.not-finite"
  | "age.must-be-positive"
  | "sex.missing"
  | "sex.unsupported"
  | "activityLevel.missing"
  | "activityLevel.unsupported";

export interface EnergyCalculatorSuccess {
  status: "success";
  bmrCalories: number;
  tdeeCalories: number;
  activityLevel: ActivityLevel;
  activityFactor: number;
  formula: "mifflin-st-jeor";
  informationalOnly: true;
}

export interface EnergyCalculatorInvalid {
  status: "invalid-input";
  errors: EnergyCalculatorErrorCode[];
}

export type EnergyCalculatorResult =
  | EnergyCalculatorSuccess
  | EnergyCalculatorInvalid;

const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

const SUPPORTED_SEXES: readonly EnergyCalculatorSex[] = ["female", "male"];
const SUPPORTED_ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very-active",
];

type RuntimeInput = Partial<Record<keyof EnergyCalculatorInput, unknown>>;

function validatePositiveNumber(
  input: RuntimeInput,
  field: "weightKg" | "heightCm" | "age",
  errors: EnergyCalculatorErrorCode[],
): void {
  const value = input[field];
  if (value === undefined || value === null) {
    errors.push(`${field}.missing`);
  } else if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field}.not-finite`);
  } else if (value <= 0) {
    errors.push(`${field}.must-be-positive`);
  }
}

/**
 * Calculates rounded BMR and TDEE values without mutating the input.
 */
export function calculateEnergy(input: EnergyCalculatorInput): EnergyCalculatorResult {
  const candidate: RuntimeInput =
    input != null && typeof input === "object" ? input : {};
  const errors: EnergyCalculatorErrorCode[] = [];

  validatePositiveNumber(candidate, "weightKg", errors);
  validatePositiveNumber(candidate, "heightCm", errors);
  validatePositiveNumber(candidate, "age", errors);

  if (candidate.sex === undefined || candidate.sex === null) {
    errors.push("sex.missing");
  } else if (
    typeof candidate.sex !== "string" ||
    !SUPPORTED_SEXES.includes(candidate.sex as EnergyCalculatorSex)
  ) {
    errors.push("sex.unsupported");
  }

  if (candidate.activityLevel === undefined || candidate.activityLevel === null) {
    errors.push("activityLevel.missing");
  } else if (
    typeof candidate.activityLevel !== "string" ||
    !SUPPORTED_ACTIVITY_LEVELS.includes(candidate.activityLevel as ActivityLevel)
  ) {
    errors.push("activityLevel.unsupported");
  }

  if (errors.length > 0) {
    return { status: "invalid-input", errors };
  }

  const validInput = candidate as unknown as EnergyCalculatorInput;
  const sexOffset = validInput.sex === "male" ? 5 : -161;
  const rawBmr =
    10 * validInput.weightKg +
    6.25 * validInput.heightCm -
    5 * validInput.age +
    sexOffset;
  const activityFactor = ACTIVITY_FACTORS[validInput.activityLevel];

  return {
    status: "success",
    bmrCalories: Math.round(rawBmr),
    tdeeCalories: Math.round(rawBmr * activityFactor),
    activityLevel: validInput.activityLevel,
    activityFactor,
    formula: "mifflin-st-jeor",
    informationalOnly: true,
  };
}
