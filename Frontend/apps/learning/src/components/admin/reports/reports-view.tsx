"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getGrades, getServiceLines } from "@/services/admin-config-service";
import {
  exportAttendanceByEmployeeExcel,
  exportTrainingHoursByEmployeeExcel,
  exportCompletionByFormatExcel,
} from "@/services/admin-reports-service";
import { useAttendanceByEmployee, useTrainingHoursByEmployee, useCompletionByFormat } from "@/hooks/use-reports";
import { downloadBlob } from "@/lib/download";
import type {
  AdminGrade,
  AdminServiceLine,
  AttendanceFilters,
  ReportFilterLabels,
} from "@/types/admin";
import { AttendanceReportTable } from "./attendance-report-table";
import { HoursReportTable } from "./hours-report-table";
import { FormatComparisonSection } from "./format-comparison-section";

const ALL = "all";
type ReportTab = "attendance" | "hours" | "format";

export function ReportsView() {
  const t = useTranslations("reports");
  const [tab, setTab] = useState<ReportTab>("attendance");
  const [gradeId, setGradeId] = useState<string>(ALL);
  const [serviceLineId, setServiceLineId] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const { data: grades } = useApiQuery<AdminGrade[]>(getGrades);
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(getServiceLines);

  const filters: AttendanceFilters = useMemo(
    () => ({
      gradeId: gradeId === ALL ? undefined : gradeId,
      serviceLineId: serviceLineId === ALL ? undefined : serviceLineId,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [gradeId, serviceLineId, from, to],
  );

  const labels: ReportFilterLabels = useMemo(
    () => ({
      gradeLabel: gradeId === ALL ? undefined : grades?.find((g) => g.id === gradeId)?.name,
      serviceLineLabel:
        serviceLineId === ALL ? undefined : serviceLines?.find((s) => s.id === serviceLineId)?.name,
    }),
    [gradeId, serviceLineId, grades, serviceLines],
  );

  const attendance = useAttendanceByEmployee(filters);
  const hours = useTrainingHoursByEmployee(filters);
  const format = useCompletionByFormat(filters);

  const hasFilter = gradeId !== ALL || serviceLineId !== ALL || !!from || !!to;
  const resetFilters = () => {
    setGradeId(ALL);
    setServiceLineId(ALL);
    setFrom("");
    setTo("");
  };

  async function handleExport() {
    setExporting(true);
    try {
      let blob: Blob;
      let filename: string;
      if (tab === "attendance") {
        blob = await exportAttendanceByEmployeeExcel(filters, labels);
        filename = "attendance-report.xlsx";
      } else if (tab === "hours") {
        blob = await exportTrainingHoursByEmployeeExcel(filters, labels);
        filename = "training-hours-report.xlsx";
      } else {
        blob = await exportCompletionByFormatExcel(filters, labels);
        filename = "format-comparison.xlsx";
      }
      downloadBlob(blob, filename);
    } catch {
      toast.error(t("export.error"));
    } finally {
      setExporting(false);
    }
  }

  const tabs: ReportTab[] = ["attendance", "hours", "format"];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-md">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("filters.grade")}</Label>
          <Select value={gradeId} onValueChange={setGradeId}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t("filters.allGrades")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allGrades")}</SelectItem>
              {(grades ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("filters.serviceLine")}</Label>
          <Select value={serviceLineId} onValueChange={setServiceLineId}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder={t("filters.allServiceLines")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allServiceLines")}</SelectItem>
              {(serviceLines ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("filters.from")}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("filters.to")}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-muted-foreground">
            {t("filters.reset")}
          </Button>
        )}
      </div>

      {/* Tab bar + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
          {tabs.map((tabKey) => (
            <Button
              key={tabKey}
              variant={tab === tabKey ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-4 text-xs font-medium ${tab === tabKey ? "" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setTab(tabKey)}
            >
              {t(`tabs.${tabKey}`)}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="h-8 gap-1.5">
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exporting ? t("export.exporting") : t("export.button")}
        </Button>
      </div>

      {/* Content */}
      {tab === "attendance" ? (
        <AttendanceReportTable rows={attendance.data ?? []} isLoading={attendance.isLoading} />
      ) : tab === "hours" ? (
        <HoursReportTable rows={hours.data ?? []} isLoading={hours.isLoading} />
      ) : (
        <FormatComparisonSection data={format.data} isLoading={format.isLoading} />
      )}
    </div>
  );
}
