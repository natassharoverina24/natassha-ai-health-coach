/**
 * Thyroid Awareness Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: no thyroid diet, no supplement recommendations, avoid
 * aggressive calorie deficits, symptom-aware coaching, recommend medical
 * follow-up when appropriate.
 *
 * This engine is deliberately more of a GUARDRAIL than a proactive coach —
 * its job is to catch and soften other engines' recommendations, not to
 * generate diet advice of its own. It hard-codes two things it will NEVER
 * output, by simply having no code path capable of producing them:
 *   1. No named "thyroid diet" or food-restriction protocol.
 *   2. No supplement, medication, or dosage recommendation of any kind.
 * Symptom mentions are only ever pointed toward a medical professional,
 * never diagnosed or treated here.
 */
import type { EngineInsight } from "./types";

const THYROID_SYMPTOM_KEYWORDS = [
  "fatigue",
  "tired",
  "cold intolerance",
  "hair loss",
  "brain fog",
  "weight gain",
];
const AGGRESSIVE_DEFICIT_RATIO = 0.75; // calorie goal below 75% of estimated maintenance is considered aggressive

export interface ThyroidEngineInput {
  calorieGoal: number;
  /** Estimated maintenance calories (e.g. from weight/height/activity), or null if not computable. */
  estimatedMaintenanceCalories: number | null;
  /** Free-text symptoms logged recently (from cycles.symptoms, the app's only symptom log). */
  recentReportedSymptoms: string[];
}

function hasThyroidRelatedSymptom(symptoms: string[]): boolean {
  return symptoms.some((s) => THYROID_SYMPTOM_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)));
}

export function runThyroidEngine(input: ThyroidEngineInput): EngineInsight[] {
  const { calorieGoal, estimatedMaintenanceCalories, recentReportedSymptoms } = input;
  const insights: EngineInsight[] = [];

  // --- avoid aggressive calorie deficits ---
  if (estimatedMaintenanceCalories && estimatedMaintenanceCalories > 0) {
    const ratio = calorieGoal / estimatedMaintenanceCalories;
    if (ratio < AGGRESSIVE_DEFICIT_RATIO) {
      insights.push({
        id: "thyroid.deficit_too_aggressive",
        engine: "thyroid",
        priority: "high",
        urgency: "soon",
        tone: "concerned",
        summary: `Calorie goal is about ${Math.round((1 - ratio) * 100)}% below estimated maintenance.`,
        reason: "Very large, sustained deficits are more likely to backfire on energy, mood, and adherence — this isn't about diet type, just the size of the gap.",
        recommendedAction: "Consider a more moderate deficit (closer to 15-20% below maintenance) and reassess after a few weeks rather than pushing harder.",
        data: {
          calorieGoal,
          estimatedMaintenanceCalories,
          deficitPercent: Math.round((1 - ratio) * 100),
        },
        suppresses: ["nutrition"],
      });
    }
  }

  // --- symptom-aware coaching + recommend medical follow-up ---
  if (hasThyroidRelatedSymptom(recentReportedSymptoms)) {
    insights.push({
      id: "thyroid.symptom_follow_up",
      engine: "thyroid",
      priority: "medium",
      urgency: "soon",
      tone: "gentle",
      summary: "Recently logged symptoms overlap with common thyroid-related symptoms.",
      reason: "Fatigue, cold intolerance, hair changes, and brain fog have many possible causes — worth ruling in or out with bloodwork rather than guessing.",
      recommendedAction: "Consider mentioning these symptoms to a doctor at the next opportunity; this app doesn't diagnose or recommend supplements for them.",
      data: { symptomCount: recentReportedSymptoms.length },
    });
  }

  return insights;
}
