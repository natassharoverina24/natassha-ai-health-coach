import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MealPage from "@/app/(app)/meal/page";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/hooks", () => ({
  useFirestoreCollection: jest.fn(),
  useFirestoreDoc: jest.fn(),
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
jest.mock("@/components/forms", () => ({
  MealEntryForm: () => null,
  OfficeLunchQuickForm: () => null,
}));
jest.mock("@/components/meal", () => {
  const actual = jest.requireActual("@/components/meal");
  return {
    ...actual,
    DailyNutritionSummary: () => null,
    MealDetailModal: () => null,
    MealTypeSection: () => null,
    QuickLogFab: () => null,
    WaterTrackerCard: () => null,
  };
});

const meal = {
  id: "meal-1",
  userId: "user-1",
  date: "2026-07-29",
  type: "lunch",
  name: "Logged lunch",
  quantity: "1 serving",
  isOfficeLunch: false,
  macros: {
    calories: 400,
    proteinG: 25,
    carbsG: 45,
    fatG: 12,
    fiberG: 5,
  },
  photoIds: [],
  score: null,
  note: null,
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { uid: "user-1" },
    profile: { lunchProvidedByOffice: false },
  });
  (useFirestoreCollection as jest.Mock).mockImplementation(
    (_subscriber: unknown, dependencies: readonly unknown[]) =>
      dependencies.length === 3
        ? { data: [], loading: false, error: null }
        : { data: [meal], loading: false, error: null },
  );
  (useFirestoreDoc as jest.Mock).mockReturnValue({
    data: null,
    loading: false,
    error: null,
  });
});

describe("/meal photo-analysis access", () => {
  it("shows a visible entry point and reveals accessible camera and file controls", async () => {
    render(<MealPage />);

    expect(screen.getByRole("link", { name: "Analyse meal photo" })).toHaveAttribute(
      "href",
      "#meal-photo-analysis",
    );
    expect(
      screen.getByRole("heading", { name: "Gemini meal-photo analysis" }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Meal to update"), "meal-1");
    expect(screen.getByRole("button", { name: "Take photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose image" })).toBeVisible();
    expect(
      screen.getByText(/upload food photos only.*do not include faces/i),
    ).toBeInTheDocument();
  });
});
