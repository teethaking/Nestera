"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Goal, Layers3, TrendingUp } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

type TooltipRecord = Record<string, number | string>;

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  payload: TooltipRecord;
};

type ChartPalette = {
  accent: string;
  accentAlt: string;
  success: string;
  violet: string;
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
};

const monthComparisonData = [
  { metric: "Deposits", previous: 28.4, current: 32.6 },
  { metric: "Yield", previous: 6.8, current: 8.1 },
  { metric: "Portfolio", previous: 118.2, current: 124.6 },
];

const yearComparisonData = [
  { month: "Jan", lastYear: 72, thisYear: 81 },
  { month: "Feb", lastYear: 74, thisYear: 84 },
  { month: "Mar", lastYear: 78, thisYear: 88 },
  { month: "Apr", lastYear: 80, thisYear: 91 },
  { month: "May", lastYear: 83, thisYear: 95 },
  { month: "Jun", lastYear: 86, thisYear: 98 },
  { month: "Jul", lastYear: 89, thisYear: 103 },
  { month: "Aug", lastYear: 92, thisYear: 108 },
  { month: "Sep", lastYear: 95, thisYear: 113 },
  { month: "Oct", lastYear: 98, thisYear: 119 },
  { month: "Nov", lastYear: 101, thisYear: 123 },
  { month: "Dec", lastYear: 104, thisYear: 129 },
];

const goalPerformanceData = [
  { goal: "Emergency", target: 75, actual: 82 },
  { goal: "Travel", target: 58, actual: 61 },
  { goal: "Home", target: 44, actual: 39 },
  { goal: "Retirement", target: 63, actual: 70 },
];

const poolPerformanceData = [
  { pool: "USDC Flex", apy: 8.2, yield30d: 2.1, tvl: 1.24 },
  { pool: "XLM Vault", apy: 11.4, yield30d: 2.8, tvl: 1.82 },
  { pool: "Blend Stable", apy: 7.1, yield30d: 1.7, tvl: 0.96 },
  { pool: "Yield Basket", apy: 9.6, yield30d: 2.4, tvl: 1.38 },
];

const paletteByTheme: Record<"light" | "dark", ChartPalette> = {
  light: {
    accent: "#0891b2",
    accentAlt: "#2563eb",
    success: "#059669",
    violet: "#7c3aed",
    text: "#0f1f2a",
    muted: "#4a7080",
    grid: "rgba(74, 112, 128, 0.12)",
    tooltipBg: "rgba(255, 255, 255, 0.98)",
    tooltipBorder: "rgba(8, 145, 178, 0.18)",
  },
  dark: {
    accent: "#00c9c8",
    accentAlt: "#60a5fa",
    success: "#34d399",
    violet: "#a78bfa",
    text: "#f8fdff",
    muted: "#6e9ba2",
    grid: "rgba(94, 140, 150, 0.12)",
    tooltipBg: "rgba(8, 20, 24, 0.96)",
    tooltipBorder: "rgba(0, 201, 200, 0.28)",
  },
};

export default function AnalyticsComparisonGrid() {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => paletteByTheme[resolvedTheme], [resolvedTheme]);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
      <ComparisonCard
        title="Month-over-month comparison"
        description="Current month versus previous month across the highest-signal portfolio levers."
        badge="+14.8% vs last month"
        summary="Deposits, yield, and portfolio value all accelerated month over month."
        icon={<TrendingUp size={18} />}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthComparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="metric" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} tickFormatter={(value: number) => `${value}k`} />
              <Tooltip content={<ComparisonTooltip palette={palette} valueSuffix="k" />} cursor={{ fill: palette.grid, opacity: 0.15 }} />
              <Legend wrapperStyle={{ color: palette.muted, fontSize: 12 }} />
              <Bar dataKey="previous" name="Previous month" fill={palette.accentAlt} radius={[8, 8, 0, 0]} maxBarSize={36} />
              <Bar dataKey="current" name="Current month" fill={palette.accent} radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ComparisonCard>

      <ComparisonCard
        title="Year-over-year comparison"
        description="Twelve-month trajectory of portfolio value compared with last year."
        badge="+$25k ahead of last year"
        summary="This year has outperformed last year in every month, widening the gap since Q2."
        icon={<ArrowUpRight size={18} />}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearComparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} tickFormatter={(value: number) => `$${value}k`} />
              <Tooltip content={<ComparisonTooltip palette={palette} valuePrefix="$" valueSuffix="k" />} />
              <Legend wrapperStyle={{ color: palette.muted, fontSize: 12 }} />
              <Line type="monotone" dataKey="lastYear" name="Last year" stroke={palette.violet} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: palette.violet }} />
              <Line type="monotone" dataKey="thisYear" name="This year" stroke={palette.accent} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: palette.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ComparisonCard>

      <ComparisonCard
        title="Goal performance comparison"
        description="Target completion versus actual completion for your active savings goals."
        badge="3 of 4 goals ahead"
        summary="Emergency, travel, and retirement goals are pacing ahead of schedule this cycle."
        icon={<Goal size={18} />}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={goalPerformanceData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="goal" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} tickFormatter={(value: number) => `${value}%`} domain={[0, 100]} />
              <Tooltip content={<ComparisonTooltip palette={palette} valueSuffix="%" />} cursor={{ fill: palette.grid, opacity: 0.15 }} />
              <Legend wrapperStyle={{ color: palette.muted, fontSize: 12 }} />
              <Bar dataKey="target" name="Target" fill={palette.accentAlt} radius={[8, 8, 0, 0]} maxBarSize={30} />
              <Bar dataKey="actual" name="Actual" fill={palette.success} radius={[8, 8, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ComparisonCard>

      <ComparisonCard
        title="Pool performance comparison"
        description="Pool APY, 30-day yield, and TVL in a single comparative view."
        badge="XLM Vault leads yield"
        summary="XLM Vault continues to deliver the strongest yield profile with the highest TVL."
        icon={<Layers3 size={18} />}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={poolPerformanceData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} vertical={false} />
              <XAxis dataKey="pool" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} tickFormatter={(value: number) => `${value}%`} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: palette.muted, fontSize: 12 }} tickFormatter={(value: number) => `$${value}m`} />
              <Tooltip content={<ComparisonTooltip palette={palette} />} />
              <Legend wrapperStyle={{ color: palette.muted, fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="apy" name="APY" fill={palette.accent} radius={[8, 8, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="left" dataKey="yield30d" name="30d Yield" fill={palette.success} radius={[8, 8, 0, 0]} maxBarSize={28} />
              <Line yAxisId="right" type="monotone" dataKey="tvl" name="TVL" stroke={palette.violet} strokeWidth={2.5} dot={{ r: 4, fill: palette.violet }} activeDot={{ r: 5, fill: palette.violet }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ComparisonCard>
    </div>
  );
}

function ComparisonCard({
  title,
  description,
  badge,
  summary,
  icon,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  summary: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-linear-to-b from-[var(--color-card-start)] to-[var(--color-card-end)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]">
              {icon}
            </span>
            <div>
              <h3 className="m-0 text-lg font-semibold text-[var(--color-text)]">{title}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
            </div>
          </div>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
          {badge}
        </span>
      </div>
      <div className="mt-5">{children}</div>
      <p className="mt-4 text-sm text-[var(--color-text-soft)]">{summary}</p>
    </article>
  );
}

function ComparisonTooltip({
  active,
  payload,
  label,
  palette,
  valuePrefix = "",
  valueSuffix = "",
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  palette: ChartPalette;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      style={{
        background: palette.tooltipBg,
        border: `1px solid ${palette.tooltipBorder}`,
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: palette.muted, marginBottom: 8 }}>{label}</p>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.map((item) => (
          <div key={String(item.dataKey ?? item.name)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: item.color ?? palette.accent,
              }}
            />
            <span style={{ color: palette.text, fontSize: 13, fontWeight: 600 }}>
              {item.name}: {formatValue(item.value, item.dataKey, valuePrefix, valueSuffix)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(
  value: number | string | undefined,
  dataKey: string | number | undefined,
  valuePrefix: string,
  valueSuffix: string
) {
  if (typeof value !== "number") {
    return value ?? "";
  }

  if (dataKey === "tvl") {
    return `$${value.toFixed(2)}m`;
  }

  if (dataKey === "apy" || dataKey === "yield30d") {
    return `${value}%`;
  }

  if (valuePrefix || valueSuffix) {
    return `${valuePrefix}${value}${valueSuffix}`;
  }

  return value.toString();
}
