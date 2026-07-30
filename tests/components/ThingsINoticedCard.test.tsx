import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThingsINoticedCard } from "@/components/today/ThingsINoticedCard";
import type { AdaptiveInsight } from "@/lib/adaptive-learning";

const insight: AdaptiveInsight = {
  id: "adaptive-observation.low-water",
  type: "low-water",
  title: "Water often finishes below the existing target",
  explanation: "The logged total was lower on several observed days.",
  evidence: {
    count: 4,
    observedDays: 7,
    windowDays: 14,
    windowStart: "2026-07-17",
    windowEnd: "2026-07-30",
    sourceIds: ["water:w1"],
  },
  suggestion: {
    text: "Consider using the existing quick water log earlier in the day.",
    applied: false,
  },
  status: "suggested",
  sourceIds: ["adaptive-observation.low-water", "water:w1"],
};

describe("Things I noticed", () => {
  it("renders a transparent observation and UI-only accept/dismiss actions", async () => {
    const user = userEvent.setup();
    render(<ThingsINoticedCard insights={[insight]} />);

    expect(
      screen.getByRole("heading", { name: "Things I noticed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Evidence: 4 of 7 observed days/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(
      screen.getByText(/does not change your targets or coaching rules/i),
    ).toBeInTheDocument();
  });

  it("renders the required empty state", () => {
    render(<ThingsINoticedCard insights={[]} />);
    expect(
      screen.getByText(
        "No strong pattern yet. Keep logging and I’ll look for repeat patterns.",
      ),
    ).toBeInTheDocument();
  });
});
