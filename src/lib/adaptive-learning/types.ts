export type AdaptiveInsightStatus = "suggested" | "accepted" | "dismissed";

export type AdaptivePatternType =
  | "breakfast-not-logged"
  | "workout-not-logged"
  | "low-protein"
  | "low-water"
  | "migraine-disruption";

export interface AdaptiveInsightEvidence {
  count: number;
  observedDays: number;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  sourceIds: string[];
}

export interface AdaptiveSuggestion {
  text: string;
  applied: false;
}

export interface AdaptiveInsight {
  id: string;
  type: AdaptivePatternType;
  title: string;
  explanation: string;
  evidence: AdaptiveInsightEvidence;
  suggestion: AdaptiveSuggestion;
  status: AdaptiveInsightStatus;
  sourceIds: string[];
}
