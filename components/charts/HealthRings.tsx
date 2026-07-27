"use client";

import { useId } from "react";

import { clampPercent } from "@/lib/utils/format";

export interface RingDatum {
  label: string;
  value: number; // 0-100
  color: string; // CSS color value
  trackColor?: string;
}

export interface HealthRingsProps {
  rings: RingDatum[]; // outer to inner
  size?: number;
  strokeWidth?: number;
  gap?: number;
}

/**
 * The dashboard's signature visual: concentric activity-style rings, the
 * clearest visual echo of "Apple Health inspired" in the whole app. Built
 * from plain SVG (no chart library) so it stays crisp at any size and can
 * be reused wherever a compact multi-metric summary is needed.
 */
export function HealthRings({
  rings,
  size = 176,
  strokeWidth = 14,
  gap = 6,
}: HealthRingsProps) {
  const idBase = useId();
  const center = size / 2;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={rings.map((r) => `${r.label} ${Math.round(r.value)} percent`).join(", ")}
    >
      {rings.map((ring, index) => {
        const radius = center - strokeWidth / 2 - index * (strokeWidth + gap);
        if (radius <= 0) return null;
        const circumference = 2 * Math.PI * radius;
        const pct = clampPercent(ring.value) / 100;
        const dashoffset = circumference * (1 - pct);
        const gradientId = `${idBase}-grad-${index}`;

        return (
          <g key={ring.label} transform={`rotate(-90 ${center} ${center})`}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={ring.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor={ring.color} stopOpacity="1" />
              </linearGradient>
            </defs>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ring.trackColor ?? "currentColor"}
              strokeOpacity={0.08}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

export interface HealthRingsLegendProps {
  rings: RingDatum[];
}

export function HealthRingsLegend({ rings }: HealthRingsLegendProps) {
  return (
    <ul className="flex flex-col gap-2">
      {rings.map((ring) => (
        <li key={ring.label} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: ring.color }}
            aria-hidden
          />
          <span className="text-ink-muted">{ring.label}</span>
          <span className="ml-auto font-semibold text-ink">
            {Math.round(clampPercent(ring.value))}%
          </span>
        </li>
      ))}
    </ul>
  );
}
