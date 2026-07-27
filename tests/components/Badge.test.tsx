import { render, screen } from "@testing-library/react";

import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders its label text", () => {
    render(<Badge>Office lunch</Badge>);
    expect(screen.getByText("Office lunch")).toBeInTheDocument();
  });
});
