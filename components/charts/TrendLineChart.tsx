"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  label: string; // formatted date label
  value: number;
}

export interface TrendLineChartProps {
  data: TrendPoint[];
  color?: string;
  unit?: string;
  height?: number;
  /** Optional reference band, e.g. goal weight, rendered as a dashed line via domain padding. */
  goalValue?: number;
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-control px-3 py-2 text-xs font-semibold text-ink shadow-[var(--shadow-card)]">
      {payload[0].value.toFixed(1)}
      {unit}
    </div>
  );
}

/**
 * Shared area/line chart for any metric trend (weight, waist, calories).
 * Kept deliberately generic — feature pages supply the data + color, this
 * component owns the visual language (soft gradient fill, no chart-junk).
 */
export function TrendLineChart({
  data,
  color = "var(--color-rose)",
  unit = "",
  height = 220,
}: TrendLineChartProps) {
  const gradientId = `trend-gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: color, strokeOpacity: 0.2 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "var(--color-bg-elevated)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
