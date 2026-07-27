/**
 * Coach Layer — Maintenance Calorie Estimate
 * ---------------------------------------------------------------------------
 * A rough Mifflin-St Jeor estimate (BMR × a light-activity factor), used
 * only by the Thyroid Awareness Engine to judge whether a calorie goal
 * represents an aggressive deficit. This is explicitly an estimate, not a
 * prescription — it's never shown to the person directly, only used as a
 * denominator for a percentage comparison.
 */
export interface MaintenanceEstimateInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "female" | "male";
}

const ACTIVITY_FACTOR_LIGHT = 1.375;

export function estimateMaintenanceCalories(input: MaintenanceEstimateInput): number | null {
  const { weightKg, heightCm, age, sex } = input;
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return null;

  const sexOffset = sex === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  return Math.round(bmr * ACTIVITY_FACTOR_LIGHT);
}

/** Derives age in whole years from a date of birth, or null if unavailable/invalid. */
export function ageFromDateOfBirth(dateOfBirthISO: string | null, today: string): number | null {
  if (!dateOfBirthISO) return null;
  const dob = new Date(dateOfBirthISO);
  const now = new Date(today);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(now.getTime())) return null;

  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : null;
}
