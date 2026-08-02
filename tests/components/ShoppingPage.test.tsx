import { render, screen, waitFor } from "@testing-library/react";

import ShoppingPage from "@/app/(app)/shopping/page";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/ai/contextBuilder", () => ({
  buildCoachDecision: jest.fn(),
  buildPlannerUserContext: jest.fn(),
}));

beforeEach(() => {
  window.localStorage.clear();
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "user-1" } });
  (buildCoachDecision as jest.Mock).mockReset().mockResolvedValue({
    insights: [],
    suppressedEngineNames: [],
    generatedAt: "2026-08-01T06:00:00.000Z",
  });
  (buildPlannerUserContext as jest.Mock).mockReset().mockResolvedValue({
    today: "2026-08-01",
    currentHour: 6,
    currentMinute: 0,
    leaveHomeTime: "06:30",
    arriveHomeTime: "19:00",
    lunchProvidedByOffice: false,
    calorieGoal: 1400,
    proteinGoalG: 100,
    waterGoalMl: 2000,
    workoutGoalMinPerDay: 30,
    stepsGoal: 8000,
    sleepGoalHours: 7,
  });
});

describe("Shopping page", () => {
  it("loads an automatic list from the deterministic weekly meal plan", async () => {
    render(<ShoppingPage />);

    expect(screen.getByRole("heading", { name: "Daftar Belanja" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Memuat shopping list" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Protein" })).toBeInTheDocument(),
    );
    expect(buildCoachDecision).toHaveBeenCalledWith("user-1");
    expect(buildPlannerUserContext).toHaveBeenCalledWith("user-1");
    expect(screen.getByText(/daftar belanja dibuat dari meal plan mingguanmu/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Peluang batch cooking" })).toBeInTheDocument();
  });

  it("shows the empty weekly-plan state when no user plan is available", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    render(<ShoppingPage />);

    expect(
      await screen.findByText(
        "Belum ada meal plan mingguan, jadi daftar belanja belum bisa dibuat.",
      ),
    ).toBeInTheDocument();
    expect(buildCoachDecision).not.toHaveBeenCalled();
  });

  it("sanitizes loader errors", async () => {
    (buildCoachDecision as jest.Mock).mockRejectedValue(
      new Error("FirebaseError: index URL https://console.firebase.google.com/secret"),
    );
    render(<ShoppingPage />);

    expect(
      await screen.findByText(/shopping list belum bisa dimuat sekarang/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/firebase|console\.firebase|secret/i)).not.toBeInTheDocument();
  });
});
