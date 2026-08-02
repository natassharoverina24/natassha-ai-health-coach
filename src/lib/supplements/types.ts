import type {
  SupplementFrequency,
  SupplementProvenance,
  SupplementStatus,
} from "@/types/firestore";

export type { SupplementProvenance, SupplementStatus };

export type SupplementSuggestedTimeOfDay =
  | "morning"
  | "morning-or-lunch"
  | "evening-or-night"
  | "user-selected";

export interface SupplementTimingSuggestion {
  suggestedTimeOfDay: SupplementSuggestedTimeOfDay;
  suggestedTime: string;
  reason: string;
  copy: string;
  caution: string;
  confidence: "low" | "medium";
  userCanOverride: true;
}

export interface SupplementSchedule {
  frequency: SupplementFrequency;
  timesOfDay: string[];
}

export interface SupplementPlanItem {
  supplementId: string;
  name: string;
  doseText: string | null;
  schedule: SupplementSchedule;
  status: SupplementStatus;
  note: string | null;
  provenance: SupplementProvenance;
  reminder: string;
  logId: string | null;
  sourceIds: string[];
}
