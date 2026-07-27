/**
 * WHY Engine
 * ---------------------------------------------------------------------------
 * Knowledge rule: persist long-term motivations, reference them naturally
 * without overusing them. The engine's whole job is picking *which*
 * motivation (if any) is worth surfacing right now — a simple
 * least-recently-referenced rotation with a cooldown, so the same line
 * doesn't show up every single day.
 */
import type { EngineInsight } from "./types";

const DEFAULT_COOLDOWN_DAYS = 3;

export interface WhyMotivation {
  id: string;
  text: string;
  lastReferencedAt: string | null; // ISO datetime
}

export interface WhyEngineInput {
  motivations: WhyMotivation[];
  now: string; // ISO datetime
  cooldownDays?: number;
}

function daysSince(isoDate: string, now: string): number {
  const diffMs = new Date(now).getTime() - new Date(isoDate).getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

export function runWhyEngine(input: WhyEngineInput): EngineInsight[] {
  const { motivations, now, cooldownDays = DEFAULT_COOLDOWN_DAYS } = input;
  if (motivations.length === 0) return [];

  const eligible = motivations.filter(
    (m) => m.lastReferencedAt == null || daysSince(m.lastReferencedAt, now) >= cooldownDays,
  );
  if (eligible.length === 0) return []; // every motivation was referenced too recently — say nothing rather than overuse one

  // Least-recently-referenced first; never-referenced motivations (null) come first of all.
  const chosen = [...eligible].sort((a, b) => {
    if (a.lastReferencedAt == null) return -1;
    if (b.lastReferencedAt == null) return 1;
    return new Date(a.lastReferencedAt).getTime() - new Date(b.lastReferencedAt).getTime();
  })[0];

  return [
    {
      id: "why.surface_motivation",
      engine: "why",
      priority: "low",
      urgency: "none",
      tone: "encouraging",
      summary: "A long-term motivation is available to reference.",
      reason: "Connecting today's action back to the underlying reason it matters is more durable motivation than the number on the scale alone.",
      recommendedAction: `Reference this motivation naturally, once, without dwelling on it: "${chosen.text}"`,
      data: { motivationId: chosen.id, motivationText: chosen.text },
    },
  ];
}
