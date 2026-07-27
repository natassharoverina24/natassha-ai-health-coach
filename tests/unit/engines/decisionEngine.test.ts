import { runDecisionEngine } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";

function insight(overrides: Partial<EngineInsight> = {}): EngineInsight {
  return {
    id: "test.insight",
    engine: "behavior",
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "Something happened.",
    reason: "Because of reasons.",
    recommendedAction: "Do a thing.",
    ...overrides,
  };
}

describe("runDecisionEngine — ranking", () => {
  it("ranks by priority first (critical > high > medium > low)", () => {
    const decision = runDecisionEngine([
      insight({ id: "low", priority: "low" }),
      insight({ id: "critical", priority: "critical" }),
      insight({ id: "medium", priority: "medium" }),
      insight({ id: "high", priority: "high" }),
    ]);
    expect(decision.insights.map((i) => i.id)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("breaks priority ties by urgency (now > soon > none)", () => {
    const decision = runDecisionEngine([
      insight({ id: "none", priority: "medium", urgency: "none" }),
      insight({ id: "now", priority: "medium", urgency: "now" }),
      insight({ id: "soon", priority: "medium", urgency: "soon" }),
    ]);
    expect(decision.insights.map((i) => i.id)).toEqual(["now", "soon", "none"]);
  });
});

describe("runDecisionEngine — capping for token efficiency", () => {
  it("caps to the default max of 5 insights", () => {
    const insights = Array.from({ length: 10 }, (_, i) => insight({ id: `i${i}` }));
    const decision = runDecisionEngine(insights);
    expect(decision.insights).toHaveLength(5);
  });

  it("respects a custom maxInsights option", () => {
    const insights = Array.from({ length: 10 }, (_, i) => insight({ id: `i${i}` }));
    const decision = runDecisionEngine(insights, { maxInsights: 2 });
    expect(decision.insights).toHaveLength(2);
  });
});

describe("runDecisionEngine — suppression / conflict resolution", () => {
  it("removes insights from a suppressed engine", () => {
    const decision = runDecisionEngine([
      insight({ id: "guardrail", engine: "thyroid", suppresses: ["nutrition"] }),
      insight({ id: "conflicting", engine: "nutrition" }),
    ]);
    expect(decision.insights.map((i) => i.id)).toEqual(["guardrail"]);
    expect(decision.suppressedEngineNames).toContain("nutrition");
  });

  it("does not suppress the guardrail insight's own engine", () => {
    const decision = runDecisionEngine([
      insight({ id: "guardrail1", engine: "thyroid", suppresses: ["nutrition"] }),
      insight({ id: "guardrail2", engine: "thyroid" }),
    ]);
    expect(decision.insights.map((i) => i.id).sort()).toEqual(["guardrail1", "guardrail2"]);
  });

  it("leaves insights alone when nothing suppresses their engine", () => {
    const decision = runDecisionEngine([insight({ id: "a", engine: "behavior" }), insight({ id: "b", engine: "nutrition" })]);
    expect(decision.insights).toHaveLength(2);
    expect(decision.suppressedEngineNames).toEqual([]);
  });
});

describe("runDecisionEngine — metadata", () => {
  it("uses the provided `now` for generatedAt", () => {
    const decision = runDecisionEngine([], { now: "2026-07-25T12:00:00.000Z" });
    expect(decision.generatedAt).toBe("2026-07-25T12:00:00.000Z");
  });

  it("returns an empty decision for no insights", () => {
    const decision = runDecisionEngine([]);
    expect(decision.insights).toEqual([]);
    expect(decision.suppressedEngineNames).toEqual([]);
  });
});
