/**
 * Menstrual Cycle Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: phase-aware coaching, PMS hunger support, water-retention
 * awareness, flexible workout intensity, weekly trend emphasis.
 *
 * Phase is estimated from the most recent `cycles` entry's start date using
 * a standard 28-day model — a heuristic, not a diagnosis, and the engine
 * produces nothing at all when there's no cycle data or the entry is stale
 * enough that the estimate would be unreliable.
 */
import type { EngineInsight } from "./types";

const CYCLE_LENGTH_DAYS = 28;
const STALE_CYCLE_DAYS = 40; // beyond this, the phase estimate is too unreliable to use

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface MenstrualEngineInput {
  /** Most recent cycle entry's start date, or null if none logged. */
  latestCycleStartDate: string | null;
  today: string;
}

export function estimateCyclePhase(daysSinceStart: number): CyclePhase | null {
  if (daysSinceStart < 0 || daysSinceStart > STALE_CYCLE_DAYS) return null;
  const dayInCycle = daysSinceStart % CYCLE_LENGTH_DAYS;
  if (dayInCycle <= 4) return "menstrual";
  if (dayInCycle <= 12) return "follicular";
  if (dayInCycle <= 15) return "ovulation";
  return "luteal";
}

export function runMenstrualEngine(input: MenstrualEngineInput): EngineInsight[] {
  const { latestCycleStartDate, today } = input;
  if (!latestCycleStartDate) return [];

  const daysSinceStart = Math.floor(
    (new Date(today).getTime() - new Date(latestCycleStartDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  const phase = estimateCyclePhase(daysSinceStart);
  if (!phase) return [];

  switch (phase) {
    case "menstrual":
      return [
        {
          id: "menstrual.flexible_intensity",
          engine: "menstrual",
          priority: "low",
          urgency: "none",
          tone: "gentle",
          summary: "Estimated to be in the menstrual phase this week.",
          reason: "Energy and comfort for intense exercise commonly dip during menstruation — this is normal, not a lapse in discipline.",
          recommendedAction: "Lower-intensity movement (walking, stretching) is a perfectly good substitute for a harder workout this week if that's what feels right.",
          data: { phase, daysSinceCycleStart: daysSinceStart },
        },
      ];
    case "luteal":
      return [
        {
          id: "menstrual.pms_hunger_support",
          engine: "menstrual",
          priority: "medium",
          urgency: "none",
          tone: "gentle",
          summary: "Estimated to be in the luteal (pre-menstrual) phase this week.",
          reason: "Increased hunger and cravings in the luteal phase are hormonally driven, not a lack of willpower — restricting harder against them usually backfires.",
          recommendedAction: "Lean into protein- and fiber-forward snacks to manage hunger rather than trying to white-knuckle through it.",
          data: { phase, daysSinceCycleStart: daysSinceStart },
        },
        {
          id: "menstrual.water_retention_awareness",
          engine: "menstrual",
          priority: "medium",
          urgency: "none",
          tone: "neutral",
          summary: "Scale weight may run higher than usual this week.",
          reason: "Water retention in the luteal phase can add a kilogram or more on the scale that has nothing to do with fat gain.",
          recommendedAction: "Weigh in as usual, but judge progress by the weekly trend rather than reacting to today's number.",
          data: { phase, daysSinceCycleStart: daysSinceStart },
        },
      ];
    case "follicular":
    case "ovulation":
      return [
        {
          id: "menstrual.phase_aware_energy",
          engine: "menstrual",
          priority: "low",
          urgency: "none",
          tone: "encouraging",
          summary: `Estimated to be in the ${phase} phase this week.`,
          reason: "Energy and exercise capacity are typically highest in this window — a good week to lean into a harder session if there's appetite for it.",
          recommendedAction: "A higher-intensity workout (including HIIT) is well-suited to this week if energy allows.",
          data: { phase, daysSinceCycleStart: daysSinceStart },
        },
      ];
    default:
      return [];
  }
}
