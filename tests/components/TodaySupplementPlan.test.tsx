import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TodaySupplementPlan } from "@/components/supplements";
import type { SupplementPlanItem } from "@/lib/supplements";

function item(overrides: Partial<SupplementPlanItem> = {}): SupplementPlanItem {
  return {
    supplementId: "supplement-1",
    name: "Supplement tersimpan",
    doseText: "teks dari user",
    schedule: { frequency: "daily", timesOfDay: ["08:00"] },
    status: "planned",
    note: null,
    provenance: "user_confirmed",
    reminder:
      "Pengingat berdasarkan supplement yang kamu simpan. Ikuti rutinitas tersimpan dan cek dengan tenaga profesional kalau ragu.",
    logId: null,
    sourceIds: ["saved-supplement:supplement-1"],
    ...overrides,
  };
}

describe("TodaySupplementPlan", () => {
  it("renders the exact empty state", () => {
    render(<TodaySupplementPlan plan={[]} onStatus={jest.fn()} />);
    expect(
      screen.getByText(
        "Belum ada supplement yang kamu simpan. Nanti kalau sudah ada, aku bantu ingetin ya 💗",
      ),
    ).toBeInTheDocument();
  });

  it("offers taken, remind-later, and skip actions", async () => {
    const user = userEvent.setup();
    const onStatus = jest.fn();
    const planned = item();
    render(<TodaySupplementPlan plan={[planned]} onStatus={onStatus} />);

    await user.click(screen.getByRole("button", { name: "Sudah diminum" }));
    await user.click(screen.getByRole("button", { name: "Nanti ingetin" }));
    await user.click(screen.getByRole("button", { name: "Skip hari ini" }));
    expect(onStatus).toHaveBeenNthCalledWith(1, planned, "taken");
    expect(onStatus).toHaveBeenNthCalledWith(2, planned, "remind-later");
    expect(onStatus).toHaveBeenNthCalledWith(3, planned, "skipped");
  });

  it("shows completed and non-judgmental skipped states", () => {
    render(
      <TodaySupplementPlan
        plan={[
          item({
            status: "skipped",
            reminder:
              "Skip hari ini tercatat. Nggak apa-apa—lanjut lagi sesuai rutinitas tersimpan saat waktunya.",
          }),
        ]}
        onStatus={jest.fn()}
      />,
    );
    expect(screen.getByText("Hari ini sudah beres 💗")).toBeInTheDocument();
    expect(screen.getByText(/nggak apa-apa/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/gagal|memalukan|kamu salah/i);
  });

  it("renders safely for mobile without green or medical claims", () => {
    const { container } = render(
      <TodaySupplementPlan
        plan={[item({ name: "Migraine saved routine", doseText: null })]}
        onStatus={jest.fn()}
      />,
    );
    expect(container.querySelector(".grid-cols-1")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/green|emerald|lime/i);
    expect(document.body.textContent).not.toMatch(
      /cure|prevent|treatment|diagnosis|prescription/i,
    );
  });
});
