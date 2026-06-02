"use client";

import React from "react";
import { Briefcase, TrendingUp, Download, FileJson, FileText, MoreHorizontal } from "lucide-react";
import { useExport } from "@/app/hooks/useExport";
import { useToast } from "@/app/context/ToastContext";

const ASSETS = [
  { name: "USDC Flexible", type: "Savings", balance: 2400, value: 2400, apy: 6.5, pnl: 156, pnlPct: 6.9 },
  { name: "XLM Locked", type: "Staking", balance: 5000, value: 1850, apy: 11.2, pnl: 207, pnlPct: 12.6 },
  { name: "USDC Goal — Emergency", type: "Goal", balance: 1200, value: 1200, apy: 5.0, pnl: 60, pnlPct: 5.3 },
  { name: "Group Pool — Alpha", type: "Group", balance: 800, value: 800, apy: 8.0, pnl: 32, pnlPct: 4.2 },
];

const PERFORMANCE = [
  { month: "Nov", value: 4800 },
  { month: "Dec", value: 5100 },
  { month: "Jan", value: 5400 },
  { month: "Feb", value: 5900 },
  { month: "Mar", value: 6050 },
  { month: "Apr", value: 6250 },
];

const MAX_VAL = Math.max(...PERFORMANCE.map((p) => p.value));

const TYPE_COLORS: Record<string, string> = {
  Savings: "text-cyan-400 bg-cyan-400/10",
  Staking: "text-violet-400 bg-violet-400/10",
  Goal: "text-emerald-400 bg-emerald-400/10",
  Group: "text-amber-400 bg-amber-400/10",
};

const exportRows = ASSETS.map(({ name, type, balance, value, apy, pnl, pnlPct }) => ({
  name, type, balance, "value_usd": value, "apy_pct": apy, "pnl_usd": pnl, "pnl_pct": pnlPct,
}));

export default function PortfolioPage() {
  const toast = useToast();
  const { exportData, loading } = useExport({
    onSuccess: (fmt, name) => toast.success("Export complete", `${name} downloaded`),
    onError: () => toast.error("Export failed", "Please try again"),
  });

  const totalValue = ASSETS.reduce((s, a) => s + a.value, 0);
  const totalPnl = ASSETS.reduce((s, a) => s + a.pnl, 0);
  const totalPnlPct = ((totalPnl / (totalValue - totalPnl)) * 100).toFixed(2);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-[#5de0e0]">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white m-0">Portfolio</h1>
            <p className="text-[#5e8c96] text-sm m-0">All assets and positions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportData(exportRows, { format: "csv", filename: "nestera-portfolio" })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#061a1a] font-bold rounded-xl transition-all active:scale-95 text-sm"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => exportData(exportRows, { format: "json", filename: "nestera-portfolio" })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 border border-cyan-500/30 text-cyan-300 font-semibold rounded-xl transition-all active:scale-95 text-sm"
          >
            <FileJson size={14} /> JSON
          </button>
          <button
            onClick={() => exportData(exportRows, { format: "pdf", filename: "nestera-tax-report", pdfTitle: "Nestera Tax Report" })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 border border-emerald-500/30 text-emerald-300 font-semibold rounded-xl transition-all active:scale-95 text-sm"
          >
            <FileText size={14} /> Tax PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-[rgba(8,120,120,0.12)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5">
          <p className="text-xs uppercase tracking-widest text-[#5e8c96] m-0">Total Value</p>
          <p className="text-3xl font-bold text-white mt-1 m-0">${totalValue.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(8,120,120,0.12)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5">
          <p className="text-xs uppercase tracking-widest text-[#5e8c96] m-0">Total P&amp;L</p>
          <p className="text-3xl font-bold text-emerald-300 mt-1 m-0">+${totalPnl}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(8,120,120,0.12)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5">
          <p className="text-xs uppercase tracking-widest text-[#5e8c96] m-0">Return</p>
          <p className="text-3xl font-bold text-emerald-300 mt-1 m-0">+{totalPnlPct}%</p>
        </div>
      </div>

      {/* Performance chart */}
      <div className="rounded-2xl border border-[rgba(8,120,120,0.12)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white m-0">Performance</h2>
          <button type="button" className="text-[#7caeb6] hover:text-cyan-300 transition-colors" aria-label="Options">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="flex items-end gap-2 h-28">
          {PERFORMANCE.map((p) => (
            <div key={p.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-cyan-500/40 to-cyan-400/80 transition-all"
                style={{ height: `${(p.value / MAX_VAL) * 100}%` }}
              />
              <span className="text-[10px] text-[#4a7080]">{p.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Asset breakdown */}
      <div className="rounded-2xl border border-[rgba(8,120,120,0.12)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5">
        <h2 className="text-base font-semibold text-white mb-4">Asset Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[#4a7080] border-b border-white/5">
                <th className="pb-3 font-medium">Asset</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium text-right">Value</th>
                <th className="pb-3 font-medium text-right">APY</th>
                <th className="pb-3 font-medium text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.name} className="border-b border-white/3 last:border-0">
                  <td className="py-3 text-white font-medium">{a.name}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[a.type]}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[#c8e8e8]">${a.value.toLocaleString()}</td>
                  <td className="py-3 text-right text-cyan-300">{a.apy}%</td>
                  <td className="py-3 text-right">
                    <span className="flex items-center justify-end gap-1 text-emerald-300">
                      <TrendingUp size={13} />
                      +${a.pnl} ({a.pnlPct}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
