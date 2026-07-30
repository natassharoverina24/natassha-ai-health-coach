import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MealPage from "@/app/(app)/meal/page";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks";
import { requestManualNutritionEstimate } from "@/lib/ai/manualNutritionEstimate";
import { invalidateTodayCoachPlanCache } from "@/lib/coach-plan/cache";
import { mealsRepository } from "@/lib/db/meals.repository";
import type { MealEntry } from "@/types/firestore";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/hooks", () => ({
  useFirestoreCollection: jest.fn(),
  useFirestoreDoc: jest.fn(),
}));
jest.mock("@/lib/ai/manualNutritionEstimate", () => {
  const actual = jest.requireActual("@/lib/ai/manualNutritionEstimate");
  return {
    ...actual,
    requestManualNutritionEstimate: jest.fn(),
  };
});
jest.mock("@/lib/coach-plan/cache", () => ({
  invalidateTodayCoachPlanCache: jest.fn(),
}));
jest.mock("@/lib/db/meals.repository", () => ({
  mealsRepository: {
    subscribeForUserByDate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock("@/lib/db/waterLogs.repository", () => ({
  waterLogsRepository: {
    subscribeForUserByDate: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock("@/lib/db/weights.repository", () => ({
  weightsRepository: { create: jest.fn() },
}));
jest.mock("@/lib/db/settings.repository", () => ({
  settingsRepository: { subscribeForUser: jest.fn() },
}));
jest.mock("@/components/meal", () => {
  const actual = jest.requireActual("@/components/meal");
  return {
    ...actual,
    MealDetailModal: () => null,
    MealPhotoSection: () => null,
    QuickLogFab: () => null,
    WaterTrackerCard: () => null,
  };
});

const rice: MealEntry = {
  id: "rice",
  createdAt: "2026-07-30T06:00:00.000Z",
  updatedAt: "2026-07-30T06:00:00.000Z",
  userId: "user-1",
  date: "2026-07-30",
  type: "lunch",
  name: "Rice",
  quantity: "1 serving",
  isOfficeLunch: false,
  macros: {
    calories: 200,
    proteinG: 4,
    carbsG: 44,
    fatG: 0.4,
    fiberG: 0.6,
  },
  photoIds: [],
  score: null,
  note: null,
};

describe("/meal manual nutrition confirmation", () => {
  const savedMeals: MealEntry[] = [rice];

  beforeEach(() => {
    savedMeals.splice(1);
    (requestManualNutritionEstimate as jest.Mock).mockClear();
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: "user-1" },
      profile: { lunchProvidedByOffice: false },
    });
    (useFirestoreCollection as jest.Mock).mockImplementation(
      (_subscriber: unknown, dependencies: readonly unknown[]) =>
        dependencies.length === 3
          ? { data: [], loading: false, error: null }
          : { data: [...savedMeals], loading: false, error: null },
    );
    (useFirestoreDoc as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });
    (requestManualNutritionEstimate as jest.Mock).mockResolvedValue({
      status: "ready",
      estimate: {
        source: "gemini-estimate",
        servingGrams: 350,
        macros: {
          calories: 320,
          proteinG: 22,
          carbsG: 35,
          fatG: 10,
        },
        assumptions: ["One medium bowl was assumed."],
        confidence: "low",
        uncertain: true,
        estimatedAt: "2026-07-30T08:00:00.000Z",
      },
    });
    (mealsRepository.create as jest.Mock).mockImplementation(
      async (input: Omit<MealEntry, "id" | "createdAt" | "updatedAt">) => {
        const saved = {
          ...input,
          id: "soto",
          createdAt: "2026-07-30T08:05:00.000Z",
          updatedAt: "2026-07-30T08:05:00.000Z",
        };
        savedMeals.push(saved);
        return "soto";
      },
    );
    (mealsRepository.update as jest.Mock).mockImplementation(
      async (id: string, input: Partial<MealEntry>) => {
        const saved = savedMeals.find((meal) => meal.id === id);
        if (saved) Object.assign(saved, input);
      },
    );
    (invalidateTodayCoachPlanCache as jest.Mock).mockReset();
  });

  it("persists corrected Soto macros, refreshes the plan, and keeps the total after rerender", async () => {
    const user = userEvent.setup();
    const view = render(<MealPage />);
    const lunchSection = screen
      .getByText("Lunch")
      .closest("div[class*='overflow-hidden']") as HTMLElement | null;
    expect(lunchSection).not.toBeNull();
    await user.click(
      within(lunchSection!).getByRole("button", { name: "Add food" }),
    );
    await user.type(screen.getByLabelText("Food name"), "Soto");
    await user.type(screen.getByLabelText("Quantity (optional)"), "1 mangkok");
    await user.click(screen.getByRole("button", { name: "Estimate nutrition" }));

    expect(mealsRepository.create).not.toHaveBeenCalled();
    const caloriesInput = screen.getByRole("spinbutton", {
      name: "Calories",
    });
    expect(caloriesInput).toHaveValue(320);
    await user.clear(caloriesInput);
    await user.type(caloriesInput, "350");
    await user.click(
      screen.getByRole("button", { name: "Confirm and save food" }),
    );

    await waitFor(() =>
      expect(mealsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Soto",
          quantity: "1 mangkok",
          macros: expect.objectContaining({
            calories: 350,
            proteinG: 22,
            carbsG: 35,
            fatG: 10,
          }),
          nutritionConfirmation: expect.objectContaining({
            source: "gemini-estimate",
            userConfirmed: true,
          }),
        }),
        expect.stringMatching(/^manual-meal-/),
      ),
    );
    expect(invalidateTodayCoachPlanCache).toHaveBeenCalledTimes(1);

    view.unmount();
    render(<MealPage />);
    expect(screen.getByText("Soto")).toBeInTheDocument();
    expect(screen.getAllByText(/550 kcal/).length).toBeGreaterThan(0);
  });

  it("repairs an unresolved existing item, updates totals, and keeps the confirmed values", async () => {
    savedMeals.push({
      ...rice,
      id: "soto-zero",
      name: "Soto",
      quantity: "1 mangkok",
      macros: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        fiberG: 0,
      },
    });
    const user = userEvent.setup();
    const view = render(<MealPage />);

    expect(
      screen.getByText(/1 item needs confirmed nutrition/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/200 kcal/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Edit Soto" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(requestManualNutritionEstimate).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Estimate with AI" }),
    );
    expect(requestManualNutritionEstimate).toHaveBeenCalledTimes(1);

    const calories = screen.getByRole("spinbutton", { name: "Calories" });
    await user.clear(calories);
    await user.type(calories, "350");
    await user.click(screen.getByRole("button", { name: "Confirm nutrition" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mealsRepository.update).toHaveBeenCalledWith(
        "soto-zero",
        expect.objectContaining({
          macros: expect.objectContaining({
            calories: 350,
            proteinG: 22,
            carbsG: 35,
            fatG: 10,
          }),
          nutritionConfirmation: expect.objectContaining({
            status: "confirmed",
            userConfirmed: true,
          }),
        }),
      ),
    );
    expect(invalidateTodayCoachPlanCache).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/550 kcal/).length).toBeGreaterThan(0);

    view.unmount();
    render(<MealPage />);
    expect(screen.queryByText(/needs confirmed nutrition/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/550 kcal/).length).toBeGreaterThan(0);
  });
});
