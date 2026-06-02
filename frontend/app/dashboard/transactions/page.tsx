"use client";

import React, { useState } from "react";
import { Download, FileJson, History, Search, ChevronDown } from "lucide-react";
import TransactionRow, { TransactionType, TransactionStatus } from "./components/TransactionRow";
import { useExport, type DateRange } from "@/app/hooks/useExport";
import { useToast } from "@/app/context/ToastContext";

type TransactionRowData = {
  date: string;
  time: string;
  transactionId: string;
  type: TransactionType;
  assetDetails: string;
  amountDisplay: string;
  isPositive: boolean | null;
  status: TransactionStatus;
  hash: string;
};

const TRANSACTIONS: TransactionRowData[] = [
  { date: "2023-10-25", time: "10:23 AM", transactionId: "0xabc...123", type: "deposit", assetDetails: "USDC", amountDisplay: "+$500.00", isPositive: true, status: "completed", hash: "0xabc" },
  { date: "2023-10-24", time: "04:15 PM", transactionId: "0xdef...456", type: "withdraw", assetDetails: "ETH", amountDisplay: "-0.50 ETH", isPositive: false, status: "completed", hash: "0xdef" },
  { date: "2023-10-24", time: "09:30 AM", transactionId: "0xghi...789", type: "swap", assetDetails: "XLM → USDC", amountDisplay: "200 USDC", isPositive: null, status: "completed", hash: "0xghi" },
  { date: "2023-10-23", time: "08:00 AM", transactionId: "0xjkl...012", type: "yield", assetDetails: "Staking Reward", amountDisplay: "+$12.45", isPositive: true, status: "pending", hash: "0xjkl" },
];

export default function TransactionHistoryPage() {
  const toast = useToast();
  const { exportData, loading } = useExport({
    onSuccess: (fmt, name) => toast.success(`Export complete`, `${name} downloaded`),
    onError: () => toast.error("Export failed", "Please try again"),
  });

  const [dateRange, setDateRange] = useState<DateRange>({});

  const rows = TRANSACTIONS.map(({ isPositive: _ip, ...rest }) => rest as Record<string, unknown>);

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-cyan-400 shadow-[0_8px_20px_rgba(6,61,61,0.3)]">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white m-0 tracking-tight">Transaction History</h1>
            <p className="text-[#5e8c96] text-sm md:text-base m-0 mt-1">
              Export your transaction history for reporting and tax purposes.
            </p>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportData(rows, { format: "csv", filename: "nestera-transactions", dateKey: "date", dateRange })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#061a1a] font-bold rounded-xl transition-all shadow-lg active:scale-95 text-sm"
          >
            <Download size={16} />
            {loading ? "Exporting…" : "CSV"}
          </button>
          <button
            onClick={() => exportData(rows, { format: "json", filename: "nestera-transactions", dateKey: "date", dateRange })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 border border-cyan-500/30 text-cyan-300 font-semibold rounded-xl transition-all active:scale-95 text-sm"
          >
            <FileJson size={16} />
            JSON
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 rounded-xl border border-white/5 bg-[#0e2330]">
        <span className="text-xs uppercase tracking-widest text-[#5e8c96] font-semibold">Date Range</span>
        <label className="flex items-center gap-2 text-sm text-[#5e8c96]">
          From
          <input
            type="date"
            value={dateRange.from ?? ""}
            onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value || undefined }))}
            className="bg-[#061a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[#5e8c96]">
          To
          <input
            type="date"
            value={dateRange.to ?? ""}
            onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value || undefined }))}
            className="bg-[#061a1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
          />
        </label>
        {(dateRange.from || dateRange.to) && (
          <button
            onClick={() => setDateRange({})}
            className="text-xs text-[#5e8c96] hover:text-white underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e8c96]" size={18} />
          <input
            type="text"
            placeholder="Search by transaction, token, or hash..."
            className="w-full bg-[#0e2330] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-[#4e7a86] focus:outline-hidden focus:border-cyan-500/50 transition-colors"
          />
        </div>
        {["Type: All", "Asset: All", "Status: All"].map((filter) => (
          <button
            type="button"
            key={filter}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#0e2330] border-white/5 text-[#5e8c96] hover:border-white/10 hover:text-white transition-all"
          >
            <span className="text-sm font-medium">{filter}</span>
            <ChevronDown size={14} opacity={0.7} />
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 bg-[#0e2330] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-[#5e8c96] text-xs font-bold uppercase tracking-widest">
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Transaction ID</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Asset / Details</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {TRANSACTIONS.map((t) => (
          <TransactionRow
            key={t.hash}
            date={t.date}
            time={t.time}
            transactionId={t.transactionId}
            type={t.type}
            assetDetails={t.assetDetails}
            amountDisplay={t.amountDisplay}
            isPositive={t.isPositive}
            status={t.status}
            onClick={(id) => console.log("Open transaction", id)}
          />
        ))}

        <div className="h-[300px] border-b border-white/5" />

        <div className="px-5 py-4 flex items-center gap-4 text-sm font-semibold justify-end">
          <button className="text-[#5e8c96] hover:text-[#e2f8f8] transition-colors">&lt; Prev</button>
          <span className="px-4 py-1.5 bg-[rgba(6,110,110,0.2)] text-[#e2f8f8] rounded-lg">Page 1 of 12</span>
          <button className="text-[#e2f8f8] hover:text-[#8ef4ef] transition-colors flex items-center gap-1">Next &gt;</button>
        </div>
      </div>
    </div>
  );
}
