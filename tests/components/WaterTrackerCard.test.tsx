import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WaterTrackerCard } from "@/components/meal/WaterTrackerCard";
import type { WaterLogEntry } from "@/types/firestore";

function makeEntry(amountMl: number, id = "w1"): WaterLogEntry {
  return {
    id,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    userId: "user-1",
    date: "2026-07-25",
    amountMl,
    loggedAt: "2026-07-25T08:00:00.000Z",
  };
}

describe("WaterTrackerCard", () => {
  it("shows the running total against the goal", () => {
    render(
      <WaterTrackerCard
        entries={[makeEntry(250), makeEntry(500, "w2")]}
        goalMl={2000}
        onQuickAdd={jest.fn()}
        onDelete={jest.fn()}
        addingAmountMl={null}
      />,
    );
    expect(screen.getByText("750 ml")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 L/)).toBeInTheDocument();
  });

  it("renders all four quick-add amounts from the spec", () => {
    render(<WaterTrackerCard entries={[]} goalMl={2000} onQuickAdd={jest.fn()} onDelete={jest.fn()} addingAmountMl={null} />);
    expect(screen.getByRole("button", { name: "+250ml" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+500ml" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+750ml" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+1L" })).toBeInTheDocument();
  });

  it("calls onQuickAdd with the tapped amount", async () => {
    const onQuickAdd = jest.fn();
    render(<WaterTrackerCard entries={[]} goalMl={2000} onQuickAdd={onQuickAdd} onDelete={jest.fn()} addingAmountMl={null} />);
    await userEvent.click(screen.getByRole("button", { name: "+500ml" }));
    expect(onQuickAdd).toHaveBeenCalledWith(500);
  });

  it("calls onDelete with the entry id", async () => {
    const onDelete = jest.fn();
    render(
      <WaterTrackerCard entries={[makeEntry(250)]} goalMl={2000} onQuickAdd={jest.fn()} onDelete={onDelete} addingAmountMl={null} />,
    );
    await userEvent.click(screen.getByLabelText("Delete water entry"));
    expect(onDelete).toHaveBeenCalledWith("w1");
  });
});
