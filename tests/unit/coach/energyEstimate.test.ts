import { ageFromDateOfBirth, estimateMaintenanceCalories } from "@/lib/coach/energyEstimate";

describe("estimateMaintenanceCalories", () => {
  it("computes a Mifflin-St Jeor estimate for a female", () => {
    // BMR = 10*65 + 6.25*160 - 5*30 - 161 = 650+1000-150-161 = 1339; *1.375 = 1841.375 -> 1841
    const result = estimateMaintenanceCalories({ weightKg: 65, heightCm: 160, age: 30, sex: "female" });
    expect(result).toBe(1841);
  });

  it("computes a Mifflin-St Jeor estimate for a male", () => {
    // BMR = 10*80 + 6.25*175 - 5*35 + 5 = 800+1093.75-175+5 = 1723.75; *1.375 = 2369.65625 -> 2370
    const result = estimateMaintenanceCalories({ weightKg: 80, heightCm: 175, age: 35, sex: "male" });
    expect(result).toBe(2370);
  });

  it("returns null for invalid inputs", () => {
    expect(estimateMaintenanceCalories({ weightKg: 0, heightCm: 160, age: 30, sex: "female" })).toBeNull();
    expect(estimateMaintenanceCalories({ weightKg: 65, heightCm: 0, age: 30, sex: "female" })).toBeNull();
    expect(estimateMaintenanceCalories({ weightKg: 65, heightCm: 160, age: 0, sex: "female" })).toBeNull();
  });
});

describe("ageFromDateOfBirth", () => {
  it("computes age when the birthday has already passed this year", () => {
    expect(ageFromDateOfBirth("1996-01-01", "2026-07-25")).toBe(30);
  });

  it("computes age when the birthday hasn't happened yet this year", () => {
    expect(ageFromDateOfBirth("1996-12-31", "2026-07-25")).toBe(29);
  });

  it("returns exact age on the birthday itself", () => {
    expect(ageFromDateOfBirth("1996-07-25", "2026-07-25")).toBe(30);
  });

  it("returns null when date of birth is null", () => {
    expect(ageFromDateOfBirth(null, "2026-07-25")).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(ageFromDateOfBirth("not-a-date", "2026-07-25")).toBeNull();
  });
});
