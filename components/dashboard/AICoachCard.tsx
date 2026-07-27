"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Sparkles, Target, Trophy } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildCoachDecision } from "@/lib/ai/contextBuilder";
import { generateCoachReply, type CoachReply } from "@/lib/ai/responseLayer";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import { mealsRepository } from "@/lib/db/meals.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { sleepLogsRepository } from "@/lib/db/sleepLogs.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { buildDailyLogInputs, computeDailyCoachScore } from "@/lib/coach";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { formatTimeLabel, todayISODate } from "@/lib/utils/format";

// ---- Daily briefing (auto-loaded, deterministic — no LLM call) ------------

type DecisionStatus = "loading" | "error" | "success";

interface DecisionState {
  status: DecisionStatus;
  decision: CoachDecision | null;
  errorMessage: string | null;
}

type ScoreStatus = "loading" | "error" | "success";

interface ScoreState {
  status: ScoreStatus;
  score: number | null;
}

// ---- Ask Coach (deeper conversation — the only part that calls the LLM) ---

type ChatStatus = "idle" | "loading" | "error" | "success";

interface ChatState {
  status: ChatStatus;
  reply: CoachReply | null;
  errorMessage: string | null;
}

const FALLBACK_WIN = "No dramatic win today, and that's okay — showing up to log is already a win.";
const NOTHING_URGENT = "Nothing urgent today. A quiet day is a good day — keep the routine going.";

function providerLabel(providerName: string): string {
  return providerName.charAt(0).toUpperCase() + providerName.slice(1);
}

/**
 * The confirmed morning-greeting tone from docs/USER_PROFILE.md §6, applied
 * as a presentation-only string here — this card never sends persona
 * instructions to the LLM's business logic (only the response layer's own
 * system prompt carries voice guidance), it only decides local UI copy from
 * the time of day.
 */
function coachGreeting(hour: number, firstName: string): string {
  if (hour < 11) return `Morning ${firstName} cantik 🌸`;
  if (hour < 15) return `Good afternoon, ${firstName} 🌸`;
  if (hour < 19) return `Good evening, ${firstName} 🌸`;
  return `Hi ${firstName} 🌸`;
}

/**
 * Splits today's already-ranked insights into the three questions a daily
 * briefing should answer, reusing existing fields only:
 *   - risk: the top-ranked insight, UNLESS it's already a celebratory one
 *     (which happens only when nothing more urgent fired today — a good
 *     day, not a risk day).
 *   - win: the highest-ranked insight actually taged "celebratory" — an
 *     "encouraging" tone alone isn't treated as a win, since several
 *     rules use that tone while still describing a shortfall to close.
 *   - actions: the remaining ranked insights (excluding whichever are
 *     already spotlighted above), capped at 3, so nothing repeats on
 *     screen.
 * No priority, urgency, or tone is computed here — every value read below
 * was already decided by the engines and the Decision Engine.
 */
function splitBriefing(insights: EngineInsight[]) {
  const topInsight = insights[0] ?? null;
  const winInsight = insights.find((insight) => insight.tone === "celebratory") ?? null;
  const riskInsight = topInsight && topInsight.tone !== "celebratory" ? topInsight : null;

  const spotlightedIds = new Set([riskInsight?.id, winInsight?.id].filter((id): id is string => Boolean(id)));
  const actionInsights = insights.filter((insight) => !spotlightedIds.has(insight.id)).slice(0, 3);

  return { riskInsight, winInsight, actionInsights };
}

/**
 * Dashboard AI Coach Card — Phase 5 polish.
 *
 * The daily briefing (score, biggest risk, today's win, action items)
 * loads automatically as soon as the user's data is available, with no
 * button press — built entirely from the existing, already-ranked
 * CoachDecision and the existing Coach Score formula, reused exactly as
 * implemented in earlier phases. Nothing here recomputes priority,
 * urgency, tone, or scoring — this file only reads fields already decided
 * elsewhere, answers "what should I do / what's my risk / what's my win"
 * from them, and lays the answer out without repeating itself.
 *
 * "Ask Coach" is the only action that calls the LLM, and only on request —
 * it reuses the same CoachDecision already loaded for the briefing rather
 * than recomputing it, and exists purely for a deeper natural-language
 * conversation on top of the plan already visible above it.
 */
export function AICoachCard() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;

  const [decisionState, setDecisionState] = useState<DecisionState>({
    status: "loading",
    decision: null,
    errorMessage: null,
  });
  const [scoreState, setScoreState] = useState<ScoreState>({ status: "loading", score: null });
  const [chatState, setChatState] = useState<ChatState>({ status: "idle", reply: null, errorMessage: null });

  const decisionRequestedRef = useRef(false);
  const chatInFlightRef = useRef(false);

  const loadDecision = useCallback(async (userId: string) => {
    setDecisionState({ status: "loading", decision: null, errorMessage: null });
    try {
      const decision = await buildCoachDecision(userId);
      setDecisionState({ status: "success", decision, errorMessage: null });
    } catch (err) {
      setDecisionState({
        status: "error",
        decision: null,
        errorMessage: err instanceof Error ? err.message : "Couldn't load today's briefing.",
      });
    }
  }, []);

  const loadTodayScore = useCallback(async (userId: string) => {
    setScoreState({ status: "loading", score: null });
    try {
      const today = todayISODate();
      const [meals, waterLogs, workouts, sleepLogs, settings] = await Promise.all([
        mealsRepository.listForUserByDate(userId, today),
        waterLogsRepository.listForUserByDate(userId, today),
        workoutsRepository.listForUserByDate(userId, today),
        sleepLogsRepository.listForUserByDate(userId, today),
        settingsRepository.getForUser(userId),
      ]);

      const goals = {
        calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
        proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
        waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
        workoutGoalMinPerDay: settings?.workoutGoalMinPerDay ?? DEFAULT_GOALS.workoutGoalMinPerDay,
        sleepGoalHours: settings?.sleepGoalHours ?? DEFAULT_GOALS.sleepGoalHours,
      };

      const [todayInput] = buildDailyLogInputs([today], { meals, waterLogs, workouts, sleepLogs });
      const dailyScore = computeDailyCoachScore(todayInput, goals);
      setScoreState({ status: "success", score: dailyScore.overall });
    } catch {
      // The score is a supplementary badge, not the core briefing — fail
      // quietly rather than blocking the (more important) insights above it.
      setScoreState({ status: "error", score: null });
    }
  }, []);

  // Auto-load once per session as soon as the user is known — no button,
  // and guarded so it never re-fires on unrelated re-renders.
  useEffect(() => {
    if (!uid || decisionRequestedRef.current) return;
    decisionRequestedRef.current = true;
    void loadDecision(uid);
    void loadTodayScore(uid);
  }, [uid, loadDecision, loadTodayScore]);

  const handleAskCoach = useCallback(async () => {
    if (chatInFlightRef.current || !decisionState.decision) return;
    chatInFlightRef.current = true;
    setChatState({ status: "loading", reply: null, errorMessage: null });
    try {
      const reply = await generateCoachReply(decisionState.decision);
      setChatState({ status: "success", reply, errorMessage: null });
    } catch (err) {
      setChatState({
        status: "error",
        reply: null,
        errorMessage: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      chatInFlightRef.current = false;
    }
  }, [decisionState.decision]);

  const firstName = profile?.displayName?.split(" ")[0] ?? "there";
  const greeting = coachGreeting(new Date().getHours(), firstName);

  const insights = decisionState.decision?.insights ?? [];
  const { riskInsight, winInsight, actionInsights } = splitBriefing(insights);

  const statusLabel =
    decisionState.status === "loading"
      ? "Putting today's briefing together…"
      : decisionState.status === "success" && decisionState.decision
        ? `Briefing ready · ${formatTimeLabel(decisionState.decision.generatedAt)}`
        : "Couldn't load today's briefing";

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Briefing</p>
          <p className="text-lg font-bold text-ink">{greeting}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{statusLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scoreState.status === "loading" && <Skeleton className="h-10 w-14 rounded-control" />}
          {scoreState.status === "success" && scoreState.score != null && (
            <div className="flex flex-col items-center rounded-control bg-petal-soft px-3 py-1.5 text-rose-strong">
              <span className="text-lg font-bold leading-tight">{scoreState.score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">Score</span>
            </div>
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-petal-soft text-rose-strong">
            <Sparkles size={18} />
          </span>
        </div>
      </div>

      {decisionState.status === "loading" && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-control" />
          <Skeleton className="h-16 w-full rounded-control" />
          <Skeleton className="h-4 w-2/3 rounded-control" />
        </div>
      )}

      {decisionState.status === "error" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-control bg-danger/10 px-3 py-2.5 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{decisionState.errorMessage}</span>
          </div>
          <Button
            onClick={() => uid && void loadDecision(uid)}
            variant="outline"
            leadingIcon={<RefreshCw size={14} />}
            className="self-start"
          >
            Retry
          </Button>
        </div>
      )}

      {decisionState.status === "success" && (
        <div className="flex flex-col gap-4 transition-opacity duration-300">
          {riskInsight ? (
            <div className="rounded-control bg-petal-soft px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-strong">
                <AlertTriangle size={12} /> Biggest risk today
              </p>
              <p className="mt-1 text-sm font-medium text-ink">{riskInsight.summary}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
                <Target size={14} className="mt-0.5 shrink-0 text-rose-strong" />
                <span>{riskInsight.recommendedAction}</span>
              </p>
            </div>
          ) : (
            <div className="rounded-control bg-teal-soft px-4 py-3">
              <p className="text-sm font-medium text-ink">{NOTHING_URGENT}</p>
            </div>
          )}

          <div className="rounded-control bg-amber-soft px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber">
              <Trophy size={12} /> Today&apos;s win
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {winInsight ? winInsight.summary : FALLBACK_WIN}
            </p>
          </div>

          {actionInsights.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Also today</p>
              <ul className="flex flex-col gap-2">
                {actionInsights.map((insight) => (
                  <li key={insight.id} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-teal" />
                    <span className="text-ink">{insight.recommendedAction}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-ink/8 pt-4">
            {chatState.status === "idle" && (
              <Button
                onClick={() => void handleAskCoach()}
                variant="ghost"
                size="sm"
                leadingIcon={<Sparkles size={14} />}
              >
                Chat with your coach
              </Button>
            )}

            {chatState.status === "loading" && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full rounded-control" />
                <Skeleton className="h-4 w-3/4 rounded-control" />
              </div>
            )}

            {chatState.status === "error" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 rounded-control bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{chatState.errorMessage}</span>
                </div>
                <Button
                  onClick={() => void handleAskCoach()}
                  variant="outline"
                  leadingIcon={<RefreshCw size={14} />}
                  className="self-start"
                >
                  Retry
                </Button>
              </div>
            )}

            {chatState.status === "success" && chatState.reply && (
              <div className="flex flex-col gap-3 transition-opacity duration-300">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  From your coach
                </p>
                <p className="text-sm leading-relaxed text-ink">{chatState.reply.message}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeLabel(decisionState.decision?.generatedAt ?? new Date().toISOString())}
                  </span>
                  <Badge tone="rose">{providerLabel(chatState.reply.providerName)}</Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
