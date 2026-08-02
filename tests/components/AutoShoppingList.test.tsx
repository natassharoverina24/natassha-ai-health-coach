import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AutoShoppingList } from "@/components/shopping";
import type { ShoppingListResult } from "@/lib/shopping-list";

const readyResult: ShoppingListResult = {
  status: "ready",
  warnings: [],
  items: [
    {
      id: "chicken",
      name: "Ayam",
      category: "protein",
      estimatedQuantity: 3,
      unit: "porsi",
      quantityStatus: "estimated",
      provenance: "meal-template",
      sourceLabel: "Dari meal plan lokal",
      sourceMeals: [
        {
          date: "2026-08-01",
          slot: "lunch",
          templateId: "chicken-rice-veg",
          mealName: "Grilled chicken with rice & vegetables",
          selectedReplacement: false,
        },
        {
          date: "2026-08-02",
          slot: "dinner",
          templateId: "chicken-rice-veg",
          mealName: "Grilled chicken with rice & vegetables",
          selectedReplacement: false,
        },
      ],
      checked: false,
    },
    {
      id: "white-rice",
      name: "Nasi putih",
      category: "carbohydrate",
      estimatedQuantity: 4,
      unit: "porsi",
      quantityStatus: "estimated",
      provenance: "selected-replacement",
      sourceLabel: "Dari menu pengganti pilihanmu",
      sourceMeals: [
        {
          date: "2026-08-01",
          slot: "dinner",
          templateId: "fish-rice-veg",
          mealName: "Grilled fish with rice & vegetables",
          selectedReplacement: true,
        },
      ],
      checked: false,
    },
  ],
};

describe("AutoShoppingList", () => {
  it("renders grouped estimated quantities and provenance", () => {
    render(<AutoShoppingList result={readyResult} />);

    expect(screen.getByRole("heading", { name: "Protein" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Karbo" })).toBeInTheDocument();
    expect(screen.getByText("~3 porsi")).toBeInTheDocument();
    expect(screen.getAllByText(/Estimasi · sesuaikan porsi/)).toHaveLength(2);
    expect(screen.getByText("Dari menu pengganti pilihanmu", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Peluang batch cooking" })).toBeInTheDocument();
    expect(screen.getByText(/dipakai di 2 menu/i)).toBeInTheDocument();
  });

  it("ticks and unticks an item locally", async () => {
    const user = userEvent.setup();
    render(<AutoShoppingList result={readyResult} />);
    const checkbox = screen.getByRole("checkbox", {
      name: "Tandai Ayam sudah dibeli",
    });

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(within(checkbox.closest("li")!).getByText("Ayam")).toHaveClass(
      "line-through",
    );
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("renders the exact friendly empty state", () => {
    render(
      <AutoShoppingList
        result={{ status: "empty", items: [], warnings: [] }}
      />,
    );
    expect(
      screen.getByText(
        "Belum ada meal plan mingguan, jadi daftar belanja belum bisa dibuat.",
      ),
    ).toBeInTheDocument();
  });

  it("renders unknown items as a friendly partial manual check", () => {
    const partial: ShoppingListResult = {
      status: "partial",
      warnings: ["Beberapa item masih butuh konfirmasi manual."],
      items: [
        {
          ...readyResult.items[0],
          id: "manual-custom",
          name: "Menu rumahan",
          category: "pantry-basic",
          estimatedQuantity: null,
          unit: null,
          quantityStatus: "needs-confirmation",
          provenance: "needs-confirmation",
          sourceLabel: "Butuh konfirmasi manual",
        },
      ],
    };
    render(<AutoShoppingList result={partial} />);

    expect(screen.getByRole("status")).toHaveTextContent(/perlu dicek manual/i);
    const item = screen.getByText("Menu rumahan").closest("li");
    expect(within(item!).getByText("Cek manual")).toBeInTheDocument();
    expect(within(item!).getByText(/Butuh konfirmasi/)).toBeInTheDocument();
  });

  it("keeps the list mobile-first without green styling", () => {
    const { container } = render(<AutoShoppingList result={readyResult} />);
    expect(container.querySelector(".grid-cols-2")).toBeNull();
    expect(container.innerHTML).not.toMatch(/green|emerald|lime/i);
  });
});
