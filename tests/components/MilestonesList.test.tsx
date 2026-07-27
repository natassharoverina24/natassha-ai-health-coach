import { render, screen } from "@testing-library/react";

import { MilestonesList } from "@/components/coach/MilestonesList";
import type { Milestone } from "@/lib/coach/types";

function makeMilestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: "weight-lost-5kg",
    category: "weight",
    title: "Lost 5 kg",
    description: "5.2 kg down since you started.",
    achievedDate: "2026-07-20",
    ...overrides,
  };
}

describe("MilestonesList", () => {
  it("shows an empty state when there are no milestones yet", () => {
    render(<MilestonesList milestones={[]} />);
    expect(screen.getByText("No milestones yet")).toBeInTheDocument();
  });

  it("renders each milestone's title, description, and category badge", () => {
    render(<MilestonesList milestones={[makeMilestone()]} />);
    expect(screen.getByText("Lost 5 kg")).toBeInTheDocument();
    expect(screen.getByText("5.2 kg down since you started.")).toBeInTheDocument();
    expect(screen.getByText("Weight")).toBeInTheDocument();
  });

  it("renders multiple milestones across categories", () => {
    render(
      <MilestonesList
        milestones={[
          makeMilestone({ id: "a", category: "weight", title: "Lost 5 kg" }),
          makeMilestone({ id: "b", category: "streak", title: "7-day streak" }),
          makeMilestone({ id: "c", category: "workout", title: "10 workouts logged" }),
        ]}
      />,
    );
    expect(screen.getByText("Lost 5 kg")).toBeInTheDocument();
    expect(screen.getByText("7-day streak")).toBeInTheDocument();
    expect(screen.getByText("10 workouts logged")).toBeInTheDocument();
  });
});
