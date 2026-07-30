import { buildMetricSummary } from "@/lib/coach-plan/buildMetricSummary";
import type { DataSourceResult } from "@/lib/coach-plan/availability";
import type {
  MealEntry,
  SleepEntry,
  UserProfile,
  WaistEntry,
  WaterLogEntry,
  WeightEntry,
  WorkoutEntry,
} from "@/types/firestore";

const today = "2026-07-29";
const baseDocument = {
  id: "entry",
  createdAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z",
};
const profile: UserProfile = {
  ...baseDocument,
  uid: "user-1",
  displayName: "User",
  email: "user@example.com",
  photoURL: null,
  country: "ID",
  heightCm: 160,
  startWeightKg: 66,
  goalWeightKg: 60,
  dateOfBirth: "1996-01-01",
  sex: "female",
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  unitSystem: "metric",
  onboardingCompleted: true,
};
const meal: MealEntry = {
  ...baseDocument,
  userId: "user-1",
  date: today,
  type: "breakfast",
  name: "Confirmed structured meal",
  quantity: null,
  isOfficeLunch: false,
  macros: {
    calories: 500,
    proteinG: 40,
    carbsG: 50,
    fatG: 15,
    fiberG: null,
  },
  photoIds: [],
  score: null,
  note: null,
};
const water: WaterLogEntry = {
  ...baseDocument,
  userId: "user-1",
  date: today,
  amountMl: 750,
  loggedAt: baseDocument.createdAt,
};
const workout: WorkoutEntry = {
  ...baseDocument,
  userId: "user-1",
  date: today,
  name: "Logged workout",
  durationMin: 20,
  note: null,
};
const sleep: SleepEntry = {
  ...baseDocument,
  userId: "user-1",
  date: today,
  hoursSlept: 6.5,
  note: null,
};
const weights: WeightEntry[] = [
  {
    ...baseDocument,
    id: "weight-current",
    userId: "user-1",
    date: today,
    weightKg: 65,
    bodyFatPercent: null,
    muscleMassKg: null,
    note: null,
    source: "manual",
  },
  {
    ...baseDocument,
    id: "weight-previous",
    userId: "user-1",
    date: "2026-07-22",
    weightKg: 65.5,
    bodyFatPercent: null,
    muscleMassKg: null,
    note: null,
    source: "manual",
  },
];
const waist: WaistEntry = {
  ...baseDocument,
  id: "waist-current",
  userId: "user-1",
  date: today,
  waistCm: 75,
  hipCm: null,
  chestCm: null,
  note: null,
};

function source<T>(
  data: T,
  status: DataSourceResult<T>["status"] = "available",
): DataSourceResult<T> {
  return { status, data };
}

function input() {
  return {
    today,
    targets: {
      calories: 1400,
      proteinG: 110,
      waterMl: 2000,
      workoutMin: 30,
      steps: 8000,
      sleepHours: 7,
    },
    profile: source<UserProfile | null>(profile),
    weights: source(weights),
    waists: source([waist]),
    meals: source([meal]),
    water: source([water]),
    workouts: source([workout]),
    sleep: source([sleep]),
  };
}

describe("buildMetricSummary", () => {
  it("builds primary progress and secondary body/energy hierarchy", () => {
    const result = buildMetricSummary(input());

    expect(result.calories).toMatchObject({
      value: 500,
      target: 1400,
      remaining: 900,
      status: "ready",
    });
    expect(result.protein).toMatchObject({
      value: 40,
      target: 110,
      remaining: 70,
      status: "ready",
    });
    expect(result.water).toMatchObject({
      value: 750,
      target: 2000,
      remaining: 1250,
      status: "ready",
    });
    expect(result.sleep.value).toBe(6.5);
    expect(result.workout.value).toBe(20);
    expect(result.coachScore).toMatchObject({
      value: expect.any(Number),
      status: "ready",
    });
    expect(result.body).toMatchObject({
      weightKg: { value: 65, status: "ready" },
      waistCm: { value: 75, status: "ready" },
      bmrKcal: { value: 1339, status: "estimated" },
      tdeeKcal: { value: 1841, status: "estimated" },
      deficitKcal: { value: 441, status: "estimated" },
      trend: {
        direction: "down",
        change: -0.5,
        sourceIds: ["repository.weights"],
      },
    });
  });

  it("keeps recorded zero values distinct from unavailable data", () => {
    const zeroInput = input();
    zeroInput.meals = source([
      { ...meal, macros: { ...meal.macros, calories: 0, proteinG: 0 } },
    ]);
    zeroInput.water = source([{ ...water, amountMl: 0 }]);
    zeroInput.workouts = source([{ ...workout, durationMin: 0 }]);
    zeroInput.sleep = source([{ ...sleep, hoursSlept: 0 }]);

    const result = buildMetricSummary(zeroInput);

    for (const metric of [
      result.calories,
      result.protein,
      result.water,
      result.sleep,
      result.workout,
    ]) {
      expect(metric.value).toBe(0);
      expect(metric.status).toBe("ready");
    }
  });

  it("uses empty and unavailable states without fabricating values", () => {
    const partialInput = input();
    partialInput.meals = source([], "empty");
    partialInput.water = {
      status: "unavailable",
      data: [],
      errorCode: "network",
    };
    partialInput.waists = source([], "empty");

    const result = buildMetricSummary(partialInput);

    expect(result.calories).toMatchObject({ value: 0, status: "empty" });
    expect(result.protein).toMatchObject({ value: 0, status: "empty" });
    expect(result.water).toMatchObject({
      value: null,
      status: "unavailable",
      remaining: null,
    });
    expect(result.coachScore).toMatchObject({
      value: null,
      status: "unavailable",
    });
    expect(result.body.waistCm).toMatchObject({
      value: null,
      status: "empty",
    });
  });

  it("does not mutate any source data", () => {
    const candidate = input();
    const before = JSON.parse(JSON.stringify(candidate));

    buildMetricSummary(candidate);

    expect(candidate).toEqual(before);
  });
});
