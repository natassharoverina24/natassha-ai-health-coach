/**
 * Decision Engine
 * ---------------------------------------------------------------------------
 * The orchestration layer above the individual engines. It does not decide
 * WHAT happened or WHY (that's each engine's job) — it decides which of
 * the resulting insights actually reach the person today:
 *
 *   1. Conflict resolution: an insight can declare it `suppresses` another
 *      engine (e.g. Thyroid's aggressive-deficit guardrail suppresses
 *      Nutrition's protein-push, since pushing harder on intake targets
 *      conflicts with easing off an aggressive deficit).
 *   2. Ranking: by priority, then urgency (see comparePriority in types.ts).
 *   3. Capping: keep only the top N insights so the AI Response Layer's
 *      prompt stays small — this is the "keep token usage efficient" rule
 *      enforced structurally, not left to the LLM to self-limit.
 */
import { comparePriority, type EngineInsight, type EngineName } from "./types";

const DEFAULT_MAX_INSIGHTS = 5;

export interface CoachDecision {
  insights: EngineInsight[];
  suppressedEngineNames: EngineName[];
  generatedAt: string;
}

export interface DecisionEngineOptions {
  maxInsights?: number;
  now?: string;
}

export function runDecisionEngine(
  allInsights: EngineInsight[],
  options: DecisionEngineOptions = {},
): CoachDecision {
  const maxInsights = options.maxInsights ?? DEFAULT_MAX_INSIGHTS;
  const now = options.now ?? new Date().toISOString();

  const suppressedEngines = new Set<EngineName>();
  for (const insight of allInsights) {
    for (const engine of insight.suppresses ?? []) {
      suppressedEngines.add(engine);
    }
  }

  // An insight is dropped if some *other* insight suppresses its engine —
  // an insight never suppresses its own engine's other insights.
  const surviving = allInsights.filter((insight) => {
    const suppressedByOthers = allInsights.some(
      (other) => other !== insight && (other.suppresses ?? []).includes(insight.engine),
    );
    return !suppressedByOthers;
  });

  const ranked = [...surviving].sort(comparePriority);
  const capped = ranked.slice(0, maxInsights);

  return {
    insights: capped,
    suppressedEngineNames: Array.from(suppressedEngines),
    generatedAt: now,
  };
}
