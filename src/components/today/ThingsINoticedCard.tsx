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
      <section aria-labelledby="things-noticed-heading">
        <h2
          id="things-noticed-heading"
          className="flex items-center gap-2 text-base font-semibold text-ink"
        >
          <Eye size={17} className="text-teal" />
          Things I noticed
        </h2>
        {insights.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No strong pattern yet. Keep logging and I’ll look for repeat
            patterns.
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
                      <span className="rounded-full bg-teal-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {insight.explanation}
                  </p>
                  <p className="mt-2 text-xs font-medium text-ink">
                    Evidence: {insight.evidence.count} of{" "}
                    {insight.evidence.observedDays} observed days in a{" "}
                    {insight.evidence.windowDays}-day window.
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Small next step: {insight.suggestion.text}
                  </p>
                  {status === "suggested" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setStatus(insight.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(insight.id, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Accepting or dismissing here does not change your targets or coaching
          rules.
        </p>
      </section>
    </GlassCard>
  );
}
