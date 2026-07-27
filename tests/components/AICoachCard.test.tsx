import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AICoachCard } from "@/components/dashboard/AICoachCard";
import { useAuth } from "@/contexts/AuthContext";
import { buildCoachDecision } from "@/lib/ai/contextBuilder";
import { generateCoachReply } from "@/lib/ai/responseLayer";
import { mealsRepository } from "@/lib/db/meals.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { sleepLogsRepository } from "@/lib/db/sleepLogs.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import type { CoachReply } from "@/lib/ai/responseLayer";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@/lib/ai/contextBuilder", () => ({
  buildCoachDecision: jest.fn(),
}));
jest.mock("@/lib/ai/responseLayer", () => ({
  generateCoachReply: jest.fn(),
}));
jest.mock("@/lib/db/meals.repository", () => ({
  mealsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/waterLogs.repository", () => ({
  waterLogsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/workouts.repository", () => ({
  workoutsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/sleepLogs.repository", () => ({
  sleepLogsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/settings.repository", () => ({
  settingsRepository: { getForUser: jest.fn() },
}));

const mockedUseAuth = useAuth as jest.Mock;
const mockedBuildCoachDecision = buildCoachDecision as jest.Mock;
const mockedGenerateCoachReply = generateCoachReply as jest.Mock;
const mockedListMeals = mealsRepository.listForUserByDate as jest.Mock;
const mockedListWater = waterLogsRepository.listForUserByDate as jest.Mock;
const mockedListWorkouts = workoutsRepository.listForUserByDate as jest.Mock;
const mockedListSleep = sleepLogsRepository.listForUserByDate as jest.Mock;
const mockedGetSettings = settingsRepository.getForUser as jest.Mock;

const proteinInsight: EngineInsight = {
  id: "nutrition.protein_first",
  engine: "nutrition",
  priority: "high",
  urgency: "soon",
  tone: "encouraging",
  summary: "Protein is at 40% of today's goal.",
  reason: "Protein supports satiety and lean mass.",
  recommendedAction: "Make the next meal protein-forward.",
};

const exerciseInsight: EngineInsight = {
  id: "exercise.minimum_action",
  engine: "exercise",
  priority: "medium",
  urgency: "soon",
  tone: "neutral",
  summary: "No workout logged yet today.",
  reason: "Walking is the lowest-barrier option.",
  recommendedAction: "Walk 30 minutes.",
};

const officeLunchInsight: EngineInsight = {
  id: "nutrition.office_lunch_reminder",
  engine: "nutrition",
  priority: "low",
  urgency: "soon",
  tone: "neutral",
  summary: "Office lunch hasn't been logged yet.",
  reason: "Easy to forget since there's no prep decision.",
  recommendedAction: "Log office lunch.",
};

const streakInsight: EngineInsight = {
  id: "behavior.consistency_reinforcement",
  engine: "behavior",
  priority: "low",
  urgency: "none",
  tone: "celebratory",
  summary: "3 days in a row scoring 70+.",
  reason: "Consistency compounds.",
  recommendedAction: "Keep the same routine tomorrow.",
};

function makeDecision(insights: EngineInsight[]): CoachDecision {
  return {
    insights,
    suppressedEngineNames: [],
    generatedAt: "2026-07-25T08:00:00.000Z",
  };
}

function makeReply(overrides: Partial<CoachReply> = {}): CoachReply {
  return {
    message: "You're doing great this week — keep it up!",
    insightIdsUsed: ["nutrition.protein_first"],
    providerName: "claude",
    ...overrides,
  };
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: { uid: "user-1" },
    profile: { displayName: "Natassha" },
  });
  mockedBuildCoachDecision
    .mockReset()
    .mockResolvedValue(makeDecision([proteinInsight, exerciseInsight, officeLunchInsight]));
  mockedGenerateCoachReply.mockReset();
  mockedListMeals.mockReset().mockResolvedValue([]);
  mockedListWater.mockReset().mockResolvedValue([]);
  mockedListWorkouts.mockReset().mockResolvedValue([]);
  mockedListSleep.mockReset().mockResolvedValue([]);
  mockedGetSettings.mockReset().mockResolvedValue(null);
});

describe("AICoachCard — auto-loads the daily briefing on mount", () => {
  it("calls buildCoachDecision automatically without any click", async () => {
    render(<AICoachCard />);
    await waitFor(() => expect(mockedBuildCoachDecision).toHaveBeenCalledWith("user-1"));
  });

  it("shows a loading skeleton before the briefing is ready", () => {
    mockedBuildCoachDecision.mockReturnValue(new Promise(() => {}));
    mockedGetSettings.mockReturnValue(new Promise(() => {}));
    render(<AICoachCard />);
    expect(screen.getByText("Putting today's briefing together…")).toBeInTheDocument();
  });

  it("does not call buildCoachDecision a second time on re-render", async () => {
    const { rerender } = render(<AICoachCard />);
    await waitFor(() => expect(mockedBuildCoachDecision).toHaveBeenCalledTimes(1));
    rerender(<AICoachCard />);
    expect(mockedBuildCoachDecision).toHaveBeenCalledTimes(1);
  });
});

describe("AICoachCard — answers what to do, the risk, and the win, without repeating itself", () => {
  it("shows the top insight as the biggest risk with its recommended action", async () => {
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Biggest risk today")).toBeInTheDocument());
    expect(screen.getByText("Protein is at 40% of today's goal.")).toBeInTheDocument();
    expect(screen.getByText("Make the next meal protein-forward.")).toBeInTheDocument();
  });

  it("lists the remaining insights under 'Also today', excluding whatever is already spotlighted", async () => {
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Also today")).toBeInTheDocument());
    expect(screen.getByText("Walk 30 minutes.")).toBeInTheDocument();
    expect(screen.getByText("Log office lunch.")).toBeInTheDocument();

    // The risk insight's own action text appears exactly once (in the risk
    // card), not a second time in the action list below it.
    expect(screen.getAllByText("Make the next meal protein-forward.")).toHaveLength(1);
  });

  it("shows the fallback win line when no insight is tagged celebratory", async () => {
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Today's win")).toBeInTheDocument());
    expect(
      screen.getByText("No dramatic win today, and that's okay — showing up to log is already a win."),
    ).toBeInTheDocument();
  });

  it("uses a genuinely celebratory insight as the win, separate from the risk", async () => {
    mockedBuildCoachDecision.mockResolvedValue(makeDecision([proteinInsight, streakInsight]));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Today's win")).toBeInTheDocument());
    expect(screen.getByText("3 days in a row scoring 70+.")).toBeInTheDocument();
    // And it must not also appear in the risk callout or the action list.
    expect(screen.getAllByText("3 days in a row scoring 70+.")).toHaveLength(1);
  });

  it("treats a celebratory top insight as good news, not a risk", async () => {
    mockedBuildCoachDecision.mockResolvedValue(makeDecision([streakInsight]));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Today's win")).toBeInTheDocument());
    expect(screen.queryByText("Biggest risk today")).not.toBeInTheDocument();
    expect(screen.getByText(/nothing urgent today/i)).toBeInTheDocument();
  });

  it("shows a calm message when there are no insights at all", async () => {
    mockedBuildCoachDecision.mockResolvedValue(makeDecision([]));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText(/nothing urgent today/i)).toBeInTheDocument());
    expect(screen.queryByText("Also today")).not.toBeInTheDocument();
  });
});

describe("AICoachCard — Coach Score", () => {
  it("fetches and displays today's score alongside the briefing", async () => {
    render(<AICoachCard />);
    await waitFor(() => expect(mockedGetSettings).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(screen.getByText("Score")).toBeInTheDocument());
  });
});

describe("AICoachCard — briefing error and retry", () => {
  it("shows an error state with retry if the briefing fails to load", async () => {
    mockedBuildCoachDecision.mockReset().mockRejectedValue(new Error("Network unavailable"));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Network unavailable")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries successfully after a failure", async () => {
    mockedBuildCoachDecision
      .mockReset()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(makeDecision([proteinInsight]));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Network unavailable")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Biggest risk today")).toBeInTheDocument());
  });
});

describe("AICoachCard — Ask Coach (deeper conversation)", () => {
  it("reuses the already-loaded decision rather than recomputing it", async () => {
    const decision = makeDecision([proteinInsight, exerciseInsight, officeLunchInsight]);
    mockedBuildCoachDecision.mockResolvedValue(decision);
    mockedGenerateCoachReply.mockResolvedValue(makeReply());
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Biggest risk today")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Chat with your coach" }));

    await waitFor(() => {
      expect(screen.getByText("You're doing great this week — keep it up!")).toBeInTheDocument();
    });
    expect(mockedBuildCoachDecision).toHaveBeenCalledTimes(1);
    expect(mockedGenerateCoachReply).toHaveBeenCalledWith(decision);
  });

  it("shows a retry button if the deeper conversation fails", async () => {
    mockedGenerateCoachReply.mockRejectedValue(new Error("Provider unavailable"));
    render(<AICoachCard />);
    await waitFor(() => expect(screen.getByText("Biggest risk today")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Chat with your coach" }));
    await waitFor(() => expect(screen.getByText("Provider unavailable")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
