"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import type {
  AdaptiveInsight,
  AdaptiveInsightStatus,
} from "@/lib/adaptive-learning";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export function ThingsINoticedCard({
  insights,
}: {
  insights: readonly AdaptiveInsight[];
}) {
  const [statuses, setStatuses] = useState<
    Record<string, AdaptiveInsightStatus>
  >({});

  const setStatus = (id: string, status: AdaptiveInsightStatus) => {
    setStatuses((current) => ({ ...current, [id]: status }));
  };

  return (
    <GlassCard>
      <section id="things-i-noticed" className="scroll-mt-24" aria-labelledby="things-noticed-heading">
        <h2
          id="things-noticed-heading"
          className="flex items-center gap-2 text-base font-semibold text-ink"
        >
          <Eye size={17} className="text-rose-strong" />
          Yang aku notice
        </h2>
        {insights.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Belum ada pola yang cukup kuat. Tetap catat aktivitasmu, nanti aku bantu perhatikan ya 💗
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {insights.map((insight) => {
              const status = statuses[insight.id] ?? insight.status;
              return (
                <li
                  key={insight.id}
                  className="rounded-control bg-bg-elevated px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {insight.title}
                    </p>
                    {status !== "suggested" && (
                      <span className="rounded-full bg-petal-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {insight.explanation}
                  </p>
                  <p className="mt-2 text-xs font-medium text-ink">
                    Terlihat {insight.evidence.count} dari{" "}
                    {insight.evidence.observedDays} hari yang tercatat dalam{" "}
                    {insight.evidence.windowDays} hari.
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Langkah kecil berikutnya: {insight.suggestion.text}
                  </p>
                  {status === "suggested" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setStatus(insight.id, "accepted")}
                      >
                        Terima
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(insight.id, "dismissed")}
                      >
                        Abaikan
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Pilihanmu di sini tidak mengubah target atau aturan coaching secara diam-diam.
        </p>
      </section>
    </GlassCard>
  );
}
