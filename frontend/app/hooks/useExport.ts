"use client";

import { useState, useCallback } from "react";

export type ExportFormat = "csv" | "json" | "pdf";

export interface DateRange {
  from?: string; // ISO date string YYYY-MM-DD
  to?: string;
}

interface UseExportOptions {
  onSuccess?: (format: ExportFormat, filename: string) => void;
  onError?: (err: Error) => void;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n") + "\n";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filterByDateRange<T extends Record<string, unknown>>(
  rows: T[],
  dateKey: string,
  range?: DateRange,
): T[] {
  if (!range?.from && !range?.to) return rows;
  return rows.filter((row) => {
    const val = row[dateKey];
    if (!val) return true;
    const d = new Date(val as string).toISOString().slice(0, 10);
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  });
}

/**
 * Builds a minimal printable PDF via the browser print dialog.
 * Supports title + table data without adding PDF library dependencies.
 */
function printAsPdf(title: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const thStyle = "border:1px solid #ccc;padding:6px 10px;background:#f5f5f5;font-size:11px;";
  const tdStyle = "border:1px solid #eee;padding:5px 10px;font-size:11px;";
  const tableRows = rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td style="${tdStyle}">${r[h] ?? ""}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:sans-serif;padding:24px;}h2{margin-bottom:12px;}table{border-collapse:collapse;width:100%;}</style>
    </head><body><h2>${title}</h2>
    <table><thead><tr>${headers.map((h) => `<th style="${thStyle}">${h}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody></table></body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function useExport(options: UseExportOptions = {}) {
  const [loading, setLoading] = useState(false);

  const exportData = useCallback(
    async <T extends Record<string, unknown>>(
      data: T[],
      {
        format,
        filename,
        dateKey,
        dateRange,
        pdfTitle,
      }: {
        format: ExportFormat;
        filename: string;
        dateKey?: string;
        dateRange?: DateRange;
        pdfTitle?: string;
      },
    ) => {
      setLoading(true);
      try {
        const filtered = dateKey
          ? filterByDateRange(data, dateKey, dateRange)
          : data;

        const stamp = new Date().toISOString().slice(0, 10);
        const fullName = `${filename}-${stamp}`;

        if (format === "csv") {
          const blob = new Blob([toCsv(filtered)], {
            type: "text/csv;charset=utf-8",
          });
          downloadBlob(blob, `${fullName}.csv`);
          options.onSuccess?.(format, `${fullName}.csv`);
        } else if (format === "json") {
          const blob = new Blob([JSON.stringify(filtered, null, 2)], {
            type: "application/json",
          });
          downloadBlob(blob, `${fullName}.json`);
          options.onSuccess?.(format, `${fullName}.json`);
        } else if (format === "pdf") {
          printAsPdf(pdfTitle ?? filename, filtered);
          options.onSuccess?.(format, `${fullName}.pdf`);
        }
      } catch (err) {
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [options],
  );

  return { exportData, loading };
}
