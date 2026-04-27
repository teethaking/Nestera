import React from "react";
import { MoreHorizontal, PieChart } from "lucide-react";
import PortfolioPerformanceChart from "./PortfolioPerformanceChart";
import AnalyticsComparisonGrid from "./AnalyticsComparisonGrid";

export const metadata = { title: "Analytics – Nestera" };

const analyticsCardClass =
  "rounded-2xl border border-[var(--color-border)] bg-linear-to-b from-[var(--color-card-start)] to-[var(--color-card-end)] p-6";

const assetAllocation = [
  { asset: "USDC", percent: 40, colorClass: "bg-cyan-400" },
  { asset: "XLM", percent: 35, colorClass: "bg-blue-400" },
  { asset: "ETH", percent: 25, colorClass: "bg-violet-400" },
];

const yieldBreakdown = [
  { label: "XLM Staking", amount: "+$420.50", progress: 57 },
  { label: "USDC Flexible", amount: "+$322.70", progress: 43 },
];

export default function AnalyticsPage() {
  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-b from-[var(--color-accent-soft)] to-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <PieChart size={20} />
        </div>
        <div>
          <h1 className="m-0 text-2xl font-bold text-[var(--color-text)]">Analytics</h1>
          <p className="m-0 text-sm text-[var(--color-text-soft)]">
            Portfolio performance and insights
          </p>
        </div>
      </div>

      <PortfolioPerformanceChart />
      <AnalyticsComparisonGrid />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className={analyticsCardClass}>
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold text-[var(--color-text)]">Asset Allocation</h3>
            <button
              type="button"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
              aria-label="Asset allocation options"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="my-6 flex items-center justify-center">
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[conic-gradient(#22d3ee_0_40%,#60a5fa_40%_75%,#a78bfa_75%_100%)]">
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-strong)]">
                <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
                  Assets
                </span>
                <span className="text-3xl font-bold leading-none text-[var(--color-text)]">3</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {assetAllocation.map((item) => (
              <div key={item.asset} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--color-text)]">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.colorClass}`} />
                  {item.asset}
                </div>
                <span className="font-semibold text-[var(--color-text-muted)]">{item.percent}%</span>
              </div>
            ))}
          </div>
        </article>

        <article className={analyticsCardClass}>
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold text-[var(--color-text)]">Yield Breakdown</h3>
            <span className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-success)]">
              APY High
            </span>
          </div>
          <p className="mt-2 mb-0 text-sm text-[var(--color-text-muted)]">
            Earnings from your active pools
          </p>

          <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-accent-soft)] p-4">
            <p className="m-0 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Total Interest Earned
            </p>
            <p className="m-0 mt-1 text-3xl font-bold text-[var(--color-text)]">$743.20</p>
          </div>

          <div className="mt-5 space-y-4">
            {yieldBreakdown.map((pool) => (
              <div key={pool.label}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text)]">{pool.label}</span>
                  <span className="text-sm font-semibold text-[var(--color-success)]">
                    {pool.amount}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-300"
                    style={{ width: `${pool.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
