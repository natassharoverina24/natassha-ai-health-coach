import {
  buildCoachDecisionWithAvailability,
  RequiredCoachDataError,
} from "@/lib/ai/contextBuilder";
import { cyclesRepository } from "@/lib/db/cycles.repository";
import { mealsRepository } from "@/lib/db/meals.repository";
import { motivationsRepository } from "@/lib/db/motivations.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { sleepLogsRepository } from "@/lib/db/sleepLogs.repository";
import { usersRepository } from "@/lib/db/users.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { weightsRepository } from "@/lib/db/weights.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import type { UserProfile } from "@/types/firestore";

jest.mock("@/lib/db/users.repository", () => ({
  usersRepository: { getByUid: jest.fn() },
}));
jest.mock("@/lib/db/settings.repository", () => ({
  settingsRepository: { getForUser: jest.fn() },
}));
jest.mock("@/lib/db/weights.repository", () => ({
  weightsRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/meals.repository", () => ({
  mealsRepository: { listForUserRange: jest.fn() },
}));
jest.mock("@/lib/db/waterLogs.repository", () => ({
  waterLogsRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/workouts.repository", () => ({
  workoutsRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/sleepLogs.repository", () => ({
  sleepLogsRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/cycles.repository", () => ({
  cyclesRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/motivations.repository", () => ({
  motivationsRepository: { listActiveForUser: jest.fn() },
}));

const profile: UserProfile = {
  id: "user-1",
  uid: "user-1",
  displayName: "User",
  email: "user@example.com",
  photoURL: null,
  country: "ID",
  heightCm: 160,
  startWeightKg: 70,
  goalWeightKg: 60,
  dateOfBirth: "1990-01-01",
  sex: "female",
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: true,
  unitSystem: "metric",
  onboardingCompleted: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-07-29T08:00:00.000Z"));
  (usersRepository.getByUid as jest.Mock).mockReset().mockResolvedValue(profile);
  (settingsRepository.getForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue(null);
  (weightsRepository.listForUser as jest.Mock).mockReset().mockResolvedValue([]);
  (mealsRepository.listForUserRange as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (waterLogsRepository.listForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (workoutsRepository.listForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (sleepLogsRepository.listForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (cyclesRepository.listForUser as jest.Mock).mockReset().mockResolvedValue([]);
  (motivationsRepository.listActiveForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
});

afterEach(() => jest.useRealTimers());

describe("buildCoachDecisionWithAvailability", () => {
  it("keeps a decision available while safely omitting an unavailable source", async () => {
    (mealsRepository.listForUserRange as jest.Mock).mockRejectedValue(
      Object.assign(new Error("private Firebase index URL"), {
        code: "failed-precondition",
      }),
    );

    const result = await buildCoachDecisionWithAvailability("user-1");

    expect(result.sources.meals).toEqual({
      status: "unavailable",
      data: [],
      errorCode: "index-building",
    });
    expect(result.decision.insights.some((item) => item.engine === "nutrition")).toBe(
      false,
    );
    expect(JSON.stringify(result.sources)).not.toMatch(/firebase|https?:/i);
  });

  it("treats a missing profile as a hard failure with a safe code", async () => {
    (usersRepository.getByUid as jest.Mock).mockResolvedValue(null);

    await expect(
      buildCoachDecisionWithAvailability("user-1"),
    ).rejects.toMatchObject<Partial<RequiredCoachDataError>>({
      name: "RequiredCoachDataError",
      source: "profile",
      errorCode: "missing-profile",
    });
  });
});
