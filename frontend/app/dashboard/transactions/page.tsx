"use client";

import React from "react";
import { Download, History } from "lucide-react";

type TransactionRow = {
  date: string;
  title: string;
  amount: string;
  token: string;
  hash: string;
};

function csvEscape(value: string) {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(rows: TransactionRow[]) {
  const header = ["date", "title", "amount", "token", "hash"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.date, r.title, r.amount, r.token, r.hash].map(csvEscape).join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TransactionHistoryPage() {
  const transactions: TransactionRow[] = [
    {
      date: "2026-03-25 10:23",
      title: "Deposit USDC",
      amount: "+500.00",
      token: "USDC",
      hash: "0x9f2a...a1b3",
    },
    {
      date: "2026-03-25 08:15",
      title: "Yield Earned",
      amount: "+12.45",
      token: "USDC",
      hash: "0x3d10...c92e",
    },
    {
      date: "2026-03-24 16:32",
      title: "Swap ETH → USDC",
      amount: "-0.50",
      token: "ETH",
      hash: "0x7a4c...1ff2",
    },
    {
      date: "2026-03-24 14:18",
      title: "Withdraw USDC",
      amount: "-250.00",
      token: "USDC",
      hash: "0x0b22...8e91",
    },
  ];

  function onExportCsv() {
    const csv = toCsv(transactions);
    downloadTextFile(`nestera-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-cyan-400 shadow-[0_8px_20px_rgba(6,61,61,0.3)]">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white m-0 tracking-tight">Transaction History</h1>
            <p className="text-[#5e8c96] text-sm md:text-base m-0 mt-1">
              Download your transactions as a CSV file for reporting.
            </p>
          </div>
        </div>

        <button
          onClick={onExportCsv}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#061a1a] font-bold rounded-xl transition-all shadow-lg active:scale-95"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#0e2330] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-[#5e8c96] text-xs font-bold uppercase tracking-widest">
          <div className="col-span-4">Date</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Token</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>

        {transactions.map((t) => (
          <div
            key={t.hash}
            className="grid grid-cols-12 px-5 py-4 border-b border-white/5 last:border-0 text-sm text-white"
          >
            <div className="col-span-4 text-[#dff]">{t.date}</div>
            <div className="col-span-4 text-[#dff]">{t.title}</div>
            <div className="col-span-2 text-[#7fbfbf] font-semibold">{t.token}</div>
            <div className="col-span-2 text-right font-bold">{t.amount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

