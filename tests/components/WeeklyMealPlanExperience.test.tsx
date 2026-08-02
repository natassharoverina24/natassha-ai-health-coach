import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WeeklyMealPlanExperience } from "@/components/dashboard/WeeklyMealPlanExperience";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import { generateMealPlan, type PlannerUserContext, type WeeklyMealPrepDay } from "@/lib/planner";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

const decision: CoachDecision = { insights: [], suppressedEngineNames: [], generatedAt: "2026-08-02T08:00:00.000Z" };
const context: PlannerUserContext = { today: "2026-08-02", currentHour: 8, currentMinute: 0, leaveHomeTime: "06:30", arriveHomeTime: "19:00", lunchProvidedByOffice: false, ...DEFAULT_GOALS };
const days: WeeklyMealPrepDay[] = [{ date: context.today, officeLunchProvided: false, mealPlan: generateMealPlan(decision, context) }];

describe("WeeklyMealPlanExperience", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders practical provenance, recipe search, and changes a menu into shopping", async () => {
    const user = userEvent.setup();
    render(<WeeklyMealPlanExperience days={days} userId="u1" />);
    expect(screen.getByText(/aku bikin variasi/i)).toBeInTheDocument();
    expect(screen.getAllByText("Katalog lokal").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Cari resep di TikTok" })[0]).toHaveAttribute("href", expect.stringContaining("tiktok.com/search"));
    await user.click(screen.getAllByRole("button", { name: "Ganti menu" })[0]);
    const option = screen.getByRole("button", { name: /Roti gandum, telur, dan pisang/i });
    await user.click(option);
    expect(screen.getByText("Roti gandum, telur, dan pisang")).toBeInTheDocument();
    expect(screen.getByText(/nutrisi perlu konfirmasi/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Protein" })).toBeInTheDocument();
  });

  it("validates and replaces a manual recipe link", async () => {
    const user = userEvent.setup();
    render(<WeeklyMealPlanExperience days={days} userId="u1" />);
    await user.click(screen.getAllByRole("button", { name: "Tambah link resep" })[0]);
    const input = screen.getByLabelText("Tambah link resep favoritmu 💗");
    await user.type(input, "not-a-url");
    await user.click(screen.getByRole("button", { name: "Simpan link" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/belum valid/i);
    await user.clear(input);
    await user.type(input, "https://www.youtube.com/watch?v=abc");
    await user.click(screen.getByRole("button", { name: "Simpan link" }));
    expect(screen.getByRole("link", { name: "Lihat resep" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc");
    await user.click(screen.getByRole("button", { name: "Ganti link" }));
    expect(screen.getByDisplayValue("https://www.youtube.com/watch?v=abc")).toBeInTheDocument();
  });

  it("keeps unknown selected ideas as a manual-check shopping item", async () => {
    const user = userEvent.setup();
    render(<WeeklyMealPlanExperience days={days} userId="u1" />);
    await user.click(screen.getAllByRole("button", { name: "Ganti menu" })[0]);
    expect(within(screen.getByRole("list", { name: "Seven-day meal plan" })).getAllByRole("button", { name: /katalog lokal/i }).length).toBeGreaterThan(0);
  });
});
