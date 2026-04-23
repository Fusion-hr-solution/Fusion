import { Check, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

type CsvImportReport = {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
};

interface CsvImportReportPopupProps {
  report: CsvImportReport | null;
}

export function CsvImportReportPopup({ report }: CsvImportReportPopupProps) {
  if (!report) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              report.importedCount > 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            )}
          >
            {report.importedCount > 0 ? (
              <Check className="h-4 w-4" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-zinc-900">CSV import summary</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                <p className="text-[14px] font-semibold text-zinc-900">{report.importedCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Imported</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                <p className="text-[14px] font-semibold text-zinc-900">{report.duplicateCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Duplicates</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center">
                <p className="text-[14px] font-semibold text-zinc-900">{report.invalidCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Invalid</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
