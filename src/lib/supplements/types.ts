import type {
  SupplementFrequency,
  SupplementProvenance,
  SupplementStatus,
} from "@/types/firestore";

export type { SupplementProvenance, SupplementStatus };

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
