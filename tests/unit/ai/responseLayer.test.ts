import { buildCoachPrompt, generateCoachReply } from "@/lib/ai/responseLayer";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { AIProvider } from "@/lib/ai/providers/types";

function makeDecision(overrides: Partial<CoachDecision> = {}): CoachDecision {
  return {
    insights: [],
    suppressedEngineNames: [],
    generatedAt: "2026-07-25T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildCoachPrompt", () => {
  it("produces a low-key check-in prompt when there are no insights", () => {
    const prompt = buildCoachPrompt(makeDecision());
    expect(prompt.userContent).toMatch(/no notable insights/i);
    expect(prompt.system.length).toBeGreaterThan(0);
  });

  it("includes every insight's summary, reason, and action verbatim", () => {
    const decision = makeDecision({
      insights: [
        {
          id: "behavior.consistency_reinforcement",
          engine: "behavior",
          priority: "low",
          urgency: "none",
          tone: "celebratory",
          summary: "5 days in a row scoring 70+.",
          reason: "Consistency compounds.",
          recommendedAction: "Keep the same routine tomorrow.",
        },
      ],
    });
    const prompt = buildCoachPrompt(decision);
    expect(prompt.userContent).toContain("5 days in a row scoring 70+.");
    expect(prompt.userContent).toContain("Consistency compounds.");
    expect(prompt.userContent).toContain("Keep the same routine tomorrow.");
    expect(prompt.userContent).toContain("celebratory");
  });

  it("includes the priority and urgency for each insight", () => {
    const decision = makeDecision({
      insights: [
        {
          id: "x",
          engine: "nutrition",
          priority: "high",
          urgency: "now",
          tone: "firm",
          summary: "S",
          reason: "R",
          recommendedAction: "A",
        },
      ],
    });
    const prompt = buildCoachPrompt(decision);
    expect(prompt.userContent).toContain("high/now");
  });

  it("never changes the system prompt based on insight content — only presentation logic lives here", () => {
    const empty = buildCoachPrompt(makeDecision());
    const withInsights = buildCoachPrompt(
      makeDecision({
        insights: [
          {
            id: "x",
            engine: "nutrition",
            priority: "high",
            urgency: "now",
            tone: "firm",
            summary: "S",
            reason: "R",
            recommendedAction: "A",
          },
        ],
      }),
    );
    expect(empty.system).toBe(withInsights.system);
  });
});

describe("generateCoachReply", () => {
  it("sends the built prompt to the given provider and returns its text", async () => {
    const mockProvider: AIProvider = {
      name: "claude",
      isConfigured: () => true,
      send: jest.fn().mockResolvedValue({ text: "You're doing great!", providerName: "claude" }),
    };

    const decision = makeDecision({
      insights: [
        {
          id: "x",
          engine: "behavior",
          priority: "low",
          urgency: "none",
          tone: "encouraging",
          summary: "S",
          reason: "R",
          recommendedAction: "A",
        },
      ],
    });

    const reply = await generateCoachReply(decision, { provider: mockProvider });

    expect(reply.message).toBe("You're doing great!");
    expect(reply.insightIdsUsed).toEqual(["x"]);
    expect(reply.providerName).toBe("claude");
    expect(mockProvider.send).toHaveBeenCalledTimes(1);
    const callArg = (mockProvider.send as jest.Mock).mock.calls[0][0];
    expect(callArg.messages[0].role).toBe("user");
    expect(callArg.messages[0].content).toContain("S");
  });

  it("passes a default maxTokens to the provider when not specified", async () => {
    const mockProvider: AIProvider = {
      name: "claude",
      isConfigured: () => true,
      send: jest.fn().mockResolvedValue({ text: "ok", providerName: "claude" }),
    };
    await generateCoachReply(makeDecision(), { provider: mockProvider });
    const callArg = (mockProvider.send as jest.Mock).mock.calls[0][0];
    expect(callArg.maxTokens).toBe(300);
  });

  it("propagates provider errors rather than swallowing them", async () => {
    const failingProvider: AIProvider = {
      name: "claude",
      isConfigured: () => true,
      send: jest.fn().mockRejectedValue(new Error("provider down")),
    };
    await expect(generateCoachReply(makeDecision(), { provider: failingProvider })).rejects.toThrow(
      "provider down",
    );
  });
});
