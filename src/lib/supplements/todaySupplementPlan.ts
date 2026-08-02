import type {
  SupplementDefinition,
  SupplementLog,
  SupplementStatus,
} from "@/types/firestore";
import type { SupplementPlanItem } from "./types";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function scheduledToday(
  supplement: SupplementDefinition,
  date: string,
): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (supplement.frequency === "daily") return true;
  if (supplement.frequency === "weekdays") return day >= 1 && day <= 5;
  return supplement.daysOfWeek?.includes(day) === true;
}

function isUserConfirmed(supplement: SupplementDefinition): boolean {
  if (supplement.userConfirmed !== undefined) return supplement.userConfirmed;
  return supplement.provenance !== "local_rule";
}

function statusFromLog(log: SupplementLog | undefined): SupplementStatus {
  if (!log) return "planned";
  if (log.status) return log.status;
  return log.taken ? "taken" : "planned";
}

export function getSupplementReminderCopy(
  status: SupplementStatus,
): string {
  switch (status) {
    case "planned":
      return "Pengingat berdasarkan supplement yang kamu simpan. Ikuti rutinitas tersimpan dan cek dengan tenaga profesional kalau ragu.";
    case "taken":
      return "Sudah tercatat diminum hari ini 💗";
    case "skipped":
      return "Skip hari ini tercatat. Nggak apa-apa—lanjut lagi sesuai rutinitas tersimpan saat waktunya.";
    case "remind-later":
      return "Oke, nanti kami ingatkan lagi saat kamu membuka halaman ini.";
  }
}

export function buildTodaySupplementPlan(
  supplements: readonly SupplementDefinition[],
  logs: readonly SupplementLog[],
  date: string,
): SupplementPlanItem[] {
  if (!isValidDate(date)) return [];
  const logBySupplementId = new Map(
    logs
      .filter((log) => log.date === date)
      .map((log) => [log.supplementId, log]),
  );

  return supplements
    .filter(
      (supplement) =>
        supplement.active &&
        isUserConfirmed(supplement) &&
        scheduledToday(supplement, date),
    )
    .map((supplement) => {
      const log = logBySupplementId.get(supplement.id);
      const status = statusFromLog(log);
      return {
        supplementId: supplement.id,
        name: supplement.name,
        doseText: supplement.dosage?.trim() || null,
        schedule: {
          frequency: supplement.frequency,
          timesOfDay: [...supplement.timesOfDay],
        },
        status,
        note: supplement.note?.trim() || null,
        provenance: supplement.provenance ?? "user_confirmed",
        reminder: getSupplementReminderCopy(status),
        logId: log?.id ?? null,
        sourceIds: [
          `saved-supplement:${supplement.id}`,
          ...(log ? [`supplement-log:${log.id}`] : []),
        ],
      };
    });
}

export function updateSupplementStatus(
  plan: readonly SupplementPlanItem[],
  supplementId: string,
  status: SupplementStatus,
): SupplementPlanItem[] {
  return plan.map((item) =>
    item.supplementId === supplementId
      ? { ...item, status, reminder: getSupplementReminderCopy(status) }
      : { ...item },
  );
}
