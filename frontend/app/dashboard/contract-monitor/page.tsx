"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface IndexerStatus {
  lastProcessedLedger: number;
  lastProcessedTimestamp: number | null;
  totalEventsProcessed: number;
  totalEventsFailed: number;
  monitoredContracts: string[];
}

interface ContractEvent {
  id: string;
  ledger: number;
  topic: string;
  txHash: string;
  timestamp: number;
  status: "ok" | "failed";
}

interface Alert {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  time: string;
}

// ── API helpers ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchIndexerStatus(): Promise<IndexerStatus | null> {
  try {
    const res = await fetch(`${API}/api/v2/blockchain/indexer/status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchRecentEvents(): Promise<ContractEvent[]> {
  try {
    const res = await fetch(`${API}/api/v2/blockchain/events?limit=20`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.data ?? [];
  } catch {
    return [];
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-[rgba(8,120,120,0.08)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[#5e8c96] text-xs uppercase tracking-widest">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
      </div>
    </article>
  );
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  return healthy ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 text-xs font-semibold">
      <CheckCircle2 size={11} /> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-400/10 border border-red-400/25 text-red-300 text-xs font-semibold">
      <XCircle size={11} /> Offline
    </span>
  );
}

function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;
  const colors: Record<Alert["level"], string> = {
    info: "border-cyan-500/25 bg-cyan-500/5 text-cyan-300",
    warn: "border-amber-400/25 bg-amber-400/5 text-amber-300",
    error: "border-red-400/25 bg-red-400/5 text-red-300",
  };
  return (
    <ul className="space-y-2" aria-label="Contract alerts">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${colors[a.level]}`}
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{a.message}</span>
          <span className="text-xs opacity-60 shrink-0">{a.time}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ContractMonitorPage() {
  const [status, setStatus] = useState<IndexerStatus | null>(null);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, e] = await Promise.all([fetchIndexerStatus(), fetchRecentEvents()]);
    setStatus(s);
    setEvents(e);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Derive simple alerts from status
  const alerts: Alert[] = [];
  if (status && status.totalEventsFailed > 0) {
    alerts.push({
      id: "dlq",
      level: "warn",
      message: `${status.totalEventsFailed} event(s) failed to process and were sent to the dead-letter queue.`,
      time: "now",
    });
  }
  if (!status) {
    alerts.push({
      id: "offline",
      level: "error",
      message: "Indexer status unavailable – backend may be offline.",
      time: lastRefresh.toLocaleTimeString(),
    });
  }

  const healthy = !!status;
  const processed = status?.totalEventsProcessed ?? 0;
  const failed = status?.totalEventsFailed ?? 0;
  const ledger = status?.lastProcessedLedger ?? "—";
  const contracts = status?.monitoredContracts?.length ?? 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-[#5de0e0]">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white m-0">Contract Monitor</h1>
            <p className="text-[#5e8c96] text-sm m-0">
              Live indexer health &amp; on-chain events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge healthy={healthy} />
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(8,120,120,0.2)] bg-[rgba(8,120,120,0.08)] text-[#5de0e0] text-xs font-semibold hover:bg-[rgba(8,120,120,0.15)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="mb-5" aria-label="Alerts">
          <AlertBanner alerts={alerts} />
        </section>
      )}

      {/* Stats grid */}
      <section aria-label="Indexer statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Events Processed"
          value={processed.toLocaleString()}
          icon={Zap}
          accent="bg-cyan-500/15 text-cyan-300"
        />
        <StatCard
          label="Failed Events"
          value={failed}
          icon={XCircle}
          accent={failed > 0 ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}
        />
        <StatCard
          label="Last Ledger"
          value={ledger}
          icon={Clock}
          accent="bg-violet-500/15 text-violet-300"
        />
        <StatCard
          label="Monitored Contracts"
          value={contracts}
          icon={Activity}
          accent="bg-amber-500/15 text-amber-300"
        />
      </section>

      {/* Main content: events + contract list */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent events table */}
        <section
          aria-label="Recent contract events"
          className="xl:col-span-2 rounded-2xl border border-[rgba(8,120,120,0.08)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5"
        >
          <h2 className="text-base font-semibold text-white mb-4">Recent Events</h2>
          {events.length === 0 ? (
            <p className="text-[#5e8c96] text-sm text-center py-8">
              {loading ? "Loading events…" : "No events indexed yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#5e8c96] text-xs uppercase tracking-wide border-b border-white/5">
                    <th className="pb-2 text-left font-medium">Ledger</th>
                    <th className="pb-2 text-left font-medium">Topic</th>
                    <th className="pb-2 text-left font-medium">Tx Hash</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 text-[#d8f3f6] tabular-nums">{ev.ledger}</td>
                      <td className="py-2.5 text-white font-mono">{ev.topic}</td>
                      <td className="py-2.5 text-[#5e8c96] font-mono text-xs">
                        {ev.txHash?.slice(0, 10)}…
                      </td>
                      <td className="py-2.5">
                        {ev.status === "ok" ? (
                          <span className="text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 size={12} /> ok
                          </span>
                        ) : (
                          <span className="text-red-300 flex items-center gap-1">
                            <XCircle size={12} /> failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Monitored contracts */}
        <section
          aria-label="Monitored contracts"
          className="rounded-2xl border border-[rgba(8,120,120,0.08)] bg-gradient-to-b from-[rgba(6,18,20,0.55)] to-[rgba(4,12,14,0.45)] p-5"
        >
          <h2 className="text-base font-semibold text-white mb-4">Monitored Contracts</h2>
          {!status?.monitoredContracts?.length ? (
            <p className="text-[#5e8c96] text-sm text-center py-8">No active contracts.</p>
          ) : (
            <ul className="space-y-2">
              {status.monitoredContracts.map((addr) => (
                <li
                  key={addr}
                  className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[#d8f3f6] font-mono text-xs break-all">{addr}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Last sync time */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <p className="text-[#5e8c96] text-xs">
              Last synced:{" "}
              <span className="text-white">
                {lastRefresh.toLocaleTimeString()}
              </span>
            </p>
            {status?.lastProcessedTimestamp && (
              <p className="text-[#5e8c96] text-xs mt-1">
                Last event:{" "}
                <span className="text-white">
                  {new Date(status.lastProcessedTimestamp).toLocaleTimeString()}
                </span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
