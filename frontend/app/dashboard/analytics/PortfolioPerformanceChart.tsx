"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MoreHorizontal, TrendingUp } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const chartData = [
  { date: "Aug 04", value: 105400 },
  { date: "Aug 11", value: 106200 },
  { date: "Aug 18", value: 107850 },
  { date: "Aug 25", value: 108700 },
  { date: "Sep 01", value: 110100 },
  { date: "Sep 08", value: 111450 },
  { date: "Sep 15", value: 113200 },
  { date: "Sep 22", value: 114900 },
  { date: "Sep 29", value: 116500 },
  { date: "Oct 01", value: 118200 },
  { date: "Oct 03", value: 119800 },
  { date: "Oct 05", value: 119500 },
  { date: "Oct 07", value: 120100 },
  { date: "Oct 09", value: 119900 },
  { date: "Oct 10", value: 120800 },
  { date: "Oct 12", value: 121200 },
  { date: "Oct 14", value: 120600 },
  { date: "Oct 16", value: 121800 },
  { date: "Oct 18", value: 122300 },
  { date: "Oct 20", value: 123100 },
  { date: "Oct 22", value: 123800 },
  { date: "Oct 25", value: 124500 },
  { date: "Oct 27", value: 124200 },
  { date: "Oct 30", value: 124800 },
  { date: "Nov 01", value: 124592 },
];

const windowDataPointLimit: Record<string, number> = {
  "7D": 7,
  "30D": 16,
  "90D": chartData.length,
};

type TooltipPayloadItem = {
  value: number;
  payload: { date: string; value: number };
};

type ChartTheme = {
  accent: string;
  accentSoft: string;
  background: string;
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
};

const chartThemeByResolvedTheme: Record<"light" | "dark", ChartTheme> = {
  light: {
    accent: "#0891b2",
    accentSoft: "rgba(8, 145, 178, 0.18)",
    background: "#ffffff",
    text: "#0f1f2a",
    muted: "#4a7080",
    grid: "rgba(74, 112, 128, 0.12)",
    tooltipBg: "rgba(255, 255, 255, 0.98)",
    tooltipBorder: "rgba(8, 145, 178, 0.18)",
  },
  dark: {
    accent: "#00c9c8",
    accentSoft: "rgba(0, 201, 200, 0.18)",
    background: "#081418",
    text: "#ffffff",
    muted: "#5e8c96",
    grid: "rgba(94, 140, 150, 0.07)",
    tooltipBg: "rgba(8, 20, 24, 0.95)",
    tooltipBorder: "rgba(0, 201, 200, 0.3)",
  },
};

function CustomTooltip({
  active,
  payload,
  theme,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  theme: ChartTheme;
}) {
  if (!active || !payload?.length) return null;

  const { date, value } = payload[0].payload;

  return (
    <div
      style={{
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: theme.muted, marginBottom: 4 }}>{date}, 2023</p>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
        $
        {value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

function ActiveDot({
  cx = 0,
  cy = 0,
  theme,
}: {
  cx?: number;
  cy?: number;
  theme: ChartTheme;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={theme.accentSoft} />
      <circle cx={cx} cy={cy} r={5} fill={theme.background} stroke={theme.accent} strokeWidth={2} />
      <line x1={cx} y1={cy + 10} x2={cx} y2={300} stroke={theme.accentSoft} strokeWidth={1} strokeDasharray="3 3" />
    </g>
  );
}

export default function PortfolioPerformanceChart() {
  const { resolvedTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState("30D");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const chartTheme = useMemo(() => chartThemeByResolvedTheme[resolvedTheme], [resolvedTheme]);
  const selectedChartData = useMemo(
    () => chartData.slice(-windowDataPointLimit[selectedWindow]),
    [selectedWindow]
  );

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-linear-to-b from-[var(--color-card-start)] to-[var(--color-card-end)]">
      <div className="flex items-start justify-between px-6 pt-6 pb-2">
        <div>
          <p className="m-0 mb-1 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            Total Portfolio Value
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-[32px] leading-tight font-bold text-[var(--color-text)]">
              $124,592.45
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
              <TrendingUp size={12} />
              +12.4%
            </span>
          </div>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
            aria-label="Portfolio performance options"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={18} />
          </button>

          {isMenuOpen ? (
            <div
              role="menu"
              aria-label="Portfolio time range"
              className="absolute right-0 top-full z-20 mt-2 min-w-[150px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] p-1.5 shadow-xl"
            >
              {["7D", "30D", "90D"].map((windowLabel) => {
                const selected = selectedWindow === windowLabel;
                return (
                  <button
                    key={windowLabel}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setSelectedWindow(windowLabel);
                      setIsMenuOpen(false);
                    }}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-sm ${
                      selected
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        : "text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]"
                    }`}
                  >
                    {windowLabel}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-6 pb-1 text-sm text-[var(--color-text-soft)]">
        Viewing the last {selectedWindow.toLowerCase()} of portfolio movement.
      </div>

      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={selectedChartData} margin={{ top: 20, right: 24, bottom: 0, left: 24 }}>
            <defs>
              <linearGradient id="portfolioAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.accent} stopOpacity={0.25} />
                <stop offset="60%" stopColor={chartTheme.accent} stopOpacity={0.06} />
                <stop offset="100%" stopColor={chartTheme.accent} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: chartTheme.muted, fontSize: 11 }} dy={10} interval={1} />
            <YAxis hide domain={["dataMin - 2000", "dataMax + 1000"]} />
            <Tooltip content={<CustomTooltip theme={chartTheme} />} cursor={false} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartTheme.accent}
              strokeWidth={2}
              fill="url(#portfolioAreaGrad)"
              activeDot={<ActiveDot theme={chartTheme} />}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
