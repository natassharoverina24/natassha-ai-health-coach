import { runWhyEngine } from "@/lib/engines/why.engine";

const NOW = "2026-07-25T12:00:00.000Z";

describe("runWhyEngine", () => {
  it("returns nothing when there are no motivations", () => {
    expect(runWhyEngine({ motivations: [], now: NOW })).toEqual([]);
  });

  it("surfaces a never-referenced motivation first", () => {
    const insights = runWhyEngine({
      motivations: [
        { id: "m1", text: "Keep up with my kids", lastReferencedAt: "2026-07-24T12:00:00.000Z" },
        { id: "m2", text: "Feel confident again", lastReferencedAt: null },
      ],
      now: NOW,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].data?.motivationId).toBe("m2");
  });

  it("picks the least-recently-referenced motivation among eligible ones", () => {
    const insights = runWhyEngine({
      motivations: [
        { id: "m1", text: "A", lastReferencedAt: "2026-07-10T12:00:00.000Z" },
        { id: "m2", text: "B", lastReferencedAt: "2026-07-15T12:00:00.000Z" },
      ],
      now: NOW,
      cooldownDays: 3,
    });
    expect(insights[0].data?.motivationId).toBe("m1");
  });

  it("respects the cooldown — recently-referenced motivations are not eligible", () => {
    const insights = runWhyEngine({
      motivations: [{ id: "m1", text: "A", lastReferencedAt: "2026-07-24T12:00:00.000Z" }],
      now: NOW,
      cooldownDays: 3,
    });
    expect(insights).toEqual([]);
  });

  it("says nothing at all when every motivation is within its cooldown", () => {
    const insights = runWhyEngine({
      motivations: [
        { id: "m1", text: "A", lastReferencedAt: "2026-07-24T12:00:00.000Z" },
        { id: "m2", text: "B", lastReferencedAt: "2026-07-23T12:00:00.000Z" },
      ],
      now: NOW,
      cooldownDays: 3,
    });
    expect(insights).toEqual([]);
  });

  it("includes the motivation text verbatim in the recommended action", () => {
    const insights = runWhyEngine({
      motivations: [{ id: "m1", text: "Run a 5k with my sister", lastReferencedAt: null }],
      now: NOW,
    });
    expect(insights[0].recommendedAction).toContain("Run a 5k with my sister");
  });
});
