import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OfficeLunchOptimizerFlow } from "@/components/dashboard/OfficeLunchOptimizerFlow";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import type { PlannerUserContext } from "@/lib/planner";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

const context: PlannerUserContext = {
  today: "2026-07-30",
  currentHour: 11,
  currentMinute: 30,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: true,
  ...DEFAULT_GOALS,
};

const baseDecision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-30T04:30:00.000Z",
};

function insight(id: string, engine: EngineInsight["engine"]): EngineInsight {
  return {
    id,
    engine,
    priority: "high",
    urgency: "now",
    tone: "gentle",
    summary: "Retained support is active.",
    reason: "This support was retained by the Decision Engine.",
    recommendedAction: "Keep lunch practical and supportive.",
  };
}

async function openFlow(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Buka Office Lunch Optimizer" }));
}

async function enterBudget(
  user: ReturnType<typeof userEvent.setup>,
  calories: string,
  protein: string,
) {
  await user.type(screen.getByLabelText("Sisa kalori"), calories);
  await user.type(screen.getByLabelText("Sisa protein"), protein);
}

describe("OfficeLunchOptimizerFlow", () => {
  it("opens from a clickable button and renders the mobile-friendly menu panel", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);

    await openFlow(user);

    expect(screen.getByRole("form", { name: "Office lunch optimizer" })).toBeInTheDocument();
    const rice = screen.getByRole("button", { name: "Nasi" });
    expect(rice).toBeInTheDocument();
    expect(rice.parentElement).toHaveClass("grid-cols-2");
    expect(document.body.innerHTML).not.toContain("bg-teal");
    expect(document.body.innerHTML).not.toContain("text-teal");
  });

  it("shows a clear empty-menu state", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);

    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Pilih minimal satu menu kantor");
  });

  it("runs only for selected catalogue items and exposes all supported action types", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);

    await user.click(screen.getByRole("button", { name: "Nasi" }));
    await user.click(screen.getByRole("button", { name: "Ayam" }));
    await enterBudget(user, "500", "40");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    const guidance = screen.getByRole("list", { name: "Arahan Office Lunch" });
    expect(within(guidance).getAllByRole("listitem")).toHaveLength(2);
    expect(within(guidance).getByText("Nasi")).toBeInTheDocument();
    expect(within(guidance).getByText("Ayam")).toBeInTheDocument();
    expect(screen.getByText(/Eat, Reduce, Add, dan Skip/)).toBeInTheDocument();
  });

  it("allows every rendered action to be checked and unchecked", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Nasi" }));
    await enterBudget(user, "500", "40");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    const checkbox = screen.getByRole("checkbox", { name: "Tandai Nasi selesai" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("returns Reduce rather than Skip for calorie overshoot alone", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Nasi" }));
    await enterBudget(user, "100", "40");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    const guidance = screen.getByRole("list", { name: "Arahan Office Lunch" });
    expect(within(guidance).getByText("Kurangi (Reduce)")).toBeInTheDocument();
    expect(within(guidance).queryByText("Lewati (Skip)")).not.toBeInTheDocument();
  });

  it("keeps Thyroid neutral and never creates a food restriction", async () => {
    const user = userEvent.setup();
    const decision: CoachDecision = {
      ...baseDecision,
      insights: [insight("thyroid.deficit_too_aggressive", "thyroid")],
    };
    render(<OfficeLunchOptimizerFlow decision={decision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Minuman manis" }));
    await enterBudget(user, "100", "40");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    const guidance = screen.getByRole("list", { name: "Arahan Office Lunch" });
    expect(within(guidance).getByText("Kurangi (Reduce)")).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(/thyroid|medical|obat|suplemen/i);
  });

  it("preserves supportive Migraine and PMS guidance without punitive wording", async () => {
    const user = userEvent.setup();
    const decision: CoachDecision = {
      ...baseDecision,
      insights: [
        insight("migraine.active_symptom_care", "migraine"),
        insight("menstrual.pms_hunger_support", "menstrual"),
      ],
    };
    render(<OfficeLunchOptimizerFlow decision={decision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Nasi" }));
    await user.click(screen.getByRole("button", { name: "Ayam" }));
    await enterBudget(user, "50", "40");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    const guidance = screen.getByRole("list", { name: "Arahan Office Lunch" });
    expect(within(guidance).getByText("Tambah (Add)")).toBeInTheDocument();
    expect(within(guidance).getByText("Kurangi (Reduce)")).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(/gagal|hukuman|kompensasi|diagnosis|obat/i);
  });

  it("keeps user-declared feeling-unwell wording neutral when no retained insight exists", async () => {
    const user = userEvent.setup();
    const decision: CoachDecision = {
      ...baseDecision,
      insights: [insight("user-declared.feeling-unwell", "behavior")],
    };
    render(<OfficeLunchOptimizerFlow decision={decision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Sup" }));
    await enterBudget(user, "300", "30");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    expect(screen.getByRole("list", { name: "Arahan Office Lunch" })).not.toHaveTextContent(
      /diagnosis|treatment|medical|obat|suplemen/i,
    );
  });

  it("shows a partial state instead of inventing missing budgets", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);
    await user.click(screen.getByRole("button", { name: "Tahu" }));
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    expect(screen.getByRole("status")).toHaveTextContent("sisa target belum lengkap");
    expect(screen.queryByRole("list", { name: "Arahan Office Lunch" })).not.toBeInTheDocument();
  });

  it("accepts a custom item but leaves it unresolved without invented nutrition", async () => {
    const user = userEvent.setup();
    render(<OfficeLunchOptimizerFlow decision={baseDecision} context={context} />);
    await openFlow(user);
    await user.type(screen.getByLabelText("Menu lain"), "Soto ayam");
    await user.click(screen.getByRole("button", { name: "Tambah menu" }));
    await enterBudget(user, "400", "35");
    await user.click(screen.getByRole("button", { name: "Buat arahan makan siang" }));

    expect(screen.getByText(/Menu custom belum ikut dinilai: Soto ayam/)).toBeInTheDocument();
    expect(screen.getByText(/Belum ada item katalog yang bisa dinilai/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Menu custom" })).not.toHaveTextContent(/kcal|protein|lemak/i);
  });
});
