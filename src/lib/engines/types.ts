/**
 * Engine Layer — Shared Types
 * ---------------------------------------------------------------------------
 * Every engine in `src/lib/engines` is a pure function: plain data in,
 * `EngineInsight[]` out. No engine calls an LLM, reads Firestore, or knows
 * anything about React — that separation is the whole point of this phase:
 *
 *   repositories (data) → context builder (assembly) → engines (decisions)
 *   → decision engine (ranking/arbitration) → AI response layer (wording)
 *
 * An `EngineInsight` already contains the *decision* — what happened, why,
 * what to do about it, how urgent, what tone to take. The AI Response Layer
 * (src/lib/ai) is only ever allowed to rephrase these fields into natural
 * language; it must never invent a fact, a number, or a recommendation that
 * isn't already sitting in an EngineInsight. That's what "never place
 * business logic inside prompt strings" means in practice.
 */

export type EngineName =
  | "behavior"
  | "nutrition"
  | "exercise"
  | "maintenance"
  | "why"
  | "migraine"
  | "menstrual"
  | "thyroid"
  | "workday"
  | "adaptiveLearning";

export type EnginePriority = "low" | "medium" | "high" | "critical";

export type EngineUrgency = "none" | "soon" | "now";

/**
 * Coaching tone the response layer should adopt when phrasing this
 * insight — decided here, deterministically, never left for the LLM to
 * infer from vibes.
 */
export type CoachTone =
  | "encouraging"
  | "neutral"
  | "firm"
  | "celebratory"
  | "gentle"
  | "concerned";

export interface EngineInsight {
  /** Stable id for the specific rule that fired, e.g. "behavior.streak_recovery". Used for de-duplication, testing, and analytics. */
  id: string;
  engine: EngineName;
  priority: EnginePriority;
  urgency: EngineUrgency;
  tone: CoachTone;
  /** WHAT happened — a short, factual statement. No adjectives the LLM didn't get from here. */
  summary: string;
  /** WHY it happened — the factual explanation behind the summary. */
  reason: string;
  /** WHAT should be done — a concrete, specific next action. */
  recommendedAction: string;
  /** Supporting figures the response layer may cite verbatim (never invent numbers). */
  data?: Record<string, string | number | boolean | null>;
  /**
   * Other engines (or specific insight ids) this insight overrides when
   * both would otherwise surface — e.g. a Thyroid guardrail suppressing a
   * Nutrition insight that recommends an aggressive deficit. Resolved by
   * the Decision Engine, never by the engines themselves.
   */
  suppresses?: EngineName[];
}

const PRIORITY_RANK: Record<EnginePriority, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const URGENCY_RANK: Record<EngineUrgency, number> = { now: 2, soon: 1, none: 0 };

export function comparePriority(a: EngineInsight, b: EngineInsight): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
}
