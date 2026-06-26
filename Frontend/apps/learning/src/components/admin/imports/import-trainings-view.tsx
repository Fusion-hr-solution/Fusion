"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Badge, Button } from "@repo/ui";
import { ApiError } from "@repo/api";
import { useApiMutation } from "@repo/api/react";
import {
  applyTrainingImport,
  downloadImportErrorLog,
  downloadImportTemplate,
  uploadTrainingImport,
} from "@/services/admin-training-import-service";
import { downloadBlob } from "@/lib/download";
import type {
  DuplicateAction,
  TrainingImportIssue,
  TrainingImportPreview,
  TrainingImportResult,
} from "@/types/admin";

const STATUS_STYLES: Record<string, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  duplicate: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

const DUPLICATE_ACTIONS: DuplicateAction[] = ["skip", "createNew", "safeUpdate"];

function IssueList({ issues }: { issues: TrainingImportIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {issues.map((issue, i) => (
        <li key={i} className={`text-xs ${issue.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
          • {issue.message}
        </li>
      ))}
    </ul>
  );
}

export function ImportTrainingsView() {
  const t = useTranslations("imports");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TrainingImportPreview | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TrainingImportResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: upload, isLoading: uploading } = useApiMutation(() => uploadTrainingImport(file!), {
    onSuccess: (res: TrainingImportPreview) => {
      setPreview(res);
      setActions({});
      setResult(null);
      toast.success(t("toast.uploaded"));
    },
    onError: (err: unknown) => {
      const description =
        err instanceof ApiError && err.errors.length > 0 ? err.errors.join(". ") : t("toast.uploadError");
      toast.error(t("toast.uploadError"), { description });
    },
  });

  const { mutate: apply, isLoading: applying } = useApiMutation(() => applyTrainingImport(file!, actions), {
    onSuccess: (res: TrainingImportResult) => {
      setResult(res);
      toast.success(t("toast.applied"));
    },
    onError: (err: unknown) => {
      const description =
        err instanceof ApiError && err.errors.length > 0 ? err.errors.join(". ") : t("toast.applyError");
      toast.error(t("toast.applyError"), { description });
    },
  });

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      downloadBlob(await downloadImportTemplate(), "training-import-template.xlsx");
    } catch {
      toast.error(t("toast.templateError"));
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadErrors() {
    if (!result) return;
    try {
      downloadBlob(await downloadImportErrorLog(result.errors), "training-import-errors.xlsx");
    } catch {
      toast.error(t("toast.errorLogError"));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setPreview(null);
    setActions({});
    setResult(null);
  }

  const summary = preview?.summary;

  // Count what an apply would actually create/update (ready rows + duplicates not set to "skip").
  const toApply = useMemo(() => {
    if (!preview) return 0;
    return preview.rows.filter((r) => {
      if (r.status === "ready") return true;
      if (r.status === "duplicate") return (actions[r.ref] ?? "skip") !== "skip";
      return false;
    }).length;
  }, [preview, actions]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-md">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Upload card */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("downloadTemplate")}
        </Button>

        <div className="h-6 w-px bg-border/60" />

        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
          <FileSpreadsheet className="h-4 w-4" />
          {t("upload.choose")}
        </Button>
        <span className="text-sm text-muted-foreground">{file ? file.name : t("upload.noFile")}</span>

        <Button size="sm" onClick={() => upload()} disabled={!file || uploading} className="ml-auto gap-1.5">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? t("upload.uploading") : t("upload.button")}
        </Button>
      </div>

      {/* Result panel (after apply) */}
      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {t("result.title")}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline" className={STATUS_STYLES.ready}>{t("result.imported", { count: result.imported })}</Badge>
            <Badge variant="outline" className={STATUS_STYLES.duplicate}>{t("result.updated", { count: result.updated })}</Badge>
            <Badge variant="outline">{t("result.skipped", { count: result.skipped })}</Badge>
            <Badge variant="outline" className={STATUS_STYLES.error}>{t("result.failed", { count: result.failed })}</Badge>
          </div>
          {result.errors.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleDownloadErrors} className="mt-3 gap-1.5">
              <Download className="h-4 w-4" />
              {t("result.downloadErrors")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {preview && summary ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{t("summary.total", { count: summary.total })}</Badge>
            <Badge variant="outline" className={STATUS_STYLES.ready}>{t("summary.ready", { count: summary.ready })}</Badge>
            <Badge variant="outline" className={STATUS_STYLES.duplicate}>{t("summary.duplicate", { count: summary.duplicate })}</Badge>
            <Badge variant="outline" className={STATUS_STYLES.error}>{t("summary.error", { count: summary.error })}</Badge>
          </div>

          {/* Global issues */}
          {preview.globalIssues.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {t("globalIssues")}
              </div>
              <IssueList issues={preview.globalIssues} />
            </div>
          ) : null}

          {/* Rows */}
          {preview.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              {t("noRows")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("cols.ref")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cols.title")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cols.category")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cols.format")}</th>
                    <th className="px-4 py-2.5 font-medium" title={t("cols.structure")}>{t("cols.structureShort")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cols.status")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("cols.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={`${row.ref}-${i}`} className="border-b border-border/40 align-top last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.ref || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-foreground">{row.title ?? "—"}</span>
                        {row.issues.length > 0 ? (
                          <div className="mt-1">
                            <IssueList issues={row.issues} />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.category ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.format ?? "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {row.sessionCount} / {row.chapterCount} / {row.contentCount}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={STATUS_STYLES[row.status] ?? ""}>
                          {t(`status.${row.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.status === "duplicate" ? (
                          <select
                            value={actions[row.ref] ?? "skip"}
                            onChange={(e) => setActions((prev) => ({ ...prev, [row.ref]: e.target.value }))}
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                          >
                            {DUPLICATE_ACTIONS.map((a) => (
                              <option key={a} value={a}>
                                {t(`actions.${a}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("previewNote")}</p>
            <Button onClick={() => apply()} disabled={applying || toApply === 0} className="gap-1.5">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {applying ? t("confirm.applying") : t("confirm.button", { count: toApply })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
