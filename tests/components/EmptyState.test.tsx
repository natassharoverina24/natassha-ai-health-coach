import { render, screen } from "@testing-library/react";

import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No entries yet" description="Log your first entry to get started." />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
    expect(screen.getByText("Log your first entry to get started.")).toBeInTheDocument();
  });

  it("renders without a description", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
