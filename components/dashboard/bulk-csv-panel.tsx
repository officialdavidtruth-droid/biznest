"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { exportProductsCsv, importProductsCsv, type ImportSummary } from "@/lib/actions/bulk";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";

export function BulkCsvPanel({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    setIsExporting(true);
    const result = await exportProductsCsv(storeSlug);
    setIsExporting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storeSlug}-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSummary(null);
    try {
      const text = await file.text();
      const result = await importProductsCsv(storeSlug, text);
      if (!result.success) {
        toast.error(result.error);
      } else {
        setSummary(result.data);
        if (result.data.created || result.data.updated) {
          toast.success(`${result.data.created} created, ${result.data.updated} updated`);
          router.refresh();
        }
        if (result.data.errors) {
          toast.error(`${result.data.errors} row(s) had errors`);
        }
      }
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border bg-background px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted/60 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />{isExporting ? "Exporting…" : "Export CSV"}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="inline-flex items-center gap-2 rounded-xl border bg-background px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted/60 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />{isImporting ? "Importing…" : "Import CSV"}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChosen} />
      </div>

      {summary && (
        <div className="w-full rounded-xl border bg-muted/30 p-3 text-xs">
          <div className="mb-2 font-medium">
            {summary.created} created · {summary.updated} updated · {summary.errors} errors
          </div>
          {summary.errors > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {summary.rows
                .filter((r) => r.status === "error")
                .map((r) => (
                  <li key={r.row} className="text-destructive">
                    Row {r.row}: {r.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
