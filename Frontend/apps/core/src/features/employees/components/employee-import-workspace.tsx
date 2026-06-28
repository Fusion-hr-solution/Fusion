"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canImportCoreEmployees, useAuth } from "@repo/auth";
import { type PageSize } from "@repo/ui";
import { toast } from "sonner";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  EmployeeImportApplyResultDto,
  EmployeeImportMode,
  EmployeeImportPreviewFilter,
} from "@/app/(pages)/employees/import/employee-import.types";
import {
  buildEmployeeImportValidationUiModel,
  type EmployeeImportIssueGroup,
} from "@/app/(pages)/employees/import/employee-import-validation";
import {
  AppliedResultPanel,
  BatchActionPanel,
  EmptyImportState,
  ImportHistoryPanel,
  IssueNavigatorPanel,
  PreviewPagination,
  SecondaryDetailsPanel,
  SelectedIssueStrip,
} from "@/app/(pages)/employees/import/employee-import-panels";
import { EmployeeImportPreviewTable } from "@/app/(pages)/employees/import/preview-table";
import {
  downloadBlob,
  getErrorMessage,
} from "@/app/(pages)/employees/import/employee-import-utils";
import { DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE } from "@/app/(pages)/employees/employee-query-keys";
import {
  useApplyEmployeeImport,
  useDownloadEmployeeImportTemplate,
  useEmployeeImportHistory,
  useEmployeeImportSchema,
  useEmployeeImportSession,
  useUploadEmployeeImport,
  useValidateEmployeeImport,
} from "@/app/(pages)/employees/import/use-employee-import";

const HISTORY_PAGE_SIZE = 5;

export default function EmployeeImportWorkspace() {
  const { user } = useAuth();
  const canAccess = canImportCoreEmployees(user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionId = searchParams.get("session");
  const [previewFilter, setPreviewFilter] =
    useState<EmployeeImportPreviewFilter>("all");
  const [activeIssueGroupKey, setActiveIssueGroupKey] = useState<string | null>(
    null
  );
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState<PageSize>(
    DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE
  );
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const [batchEffectiveDate, setBatchEffectiveDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [importMode, setImportMode] = useState<EmployeeImportMode>("BusinessChange");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [lastApplyResult, setLastApplyResult] =
    useState<EmployeeImportApplyResultDto | null>(null);
  const [isAppliedPreviewOpen, setIsAppliedPreviewOpen] = useState(false);
  const [pendingScrollRowNumber, setPendingScrollRowNumber] = useState<
    number | null
  >(null);

  const {
    data: schema,
    error: schemaError,
    isLoading: isSchemaLoading,
  } = useEmployeeImportSchema();
  const {
    data: session,
    error: sessionError,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useEmployeeImportSession(sessionId, {
    pageNumber: currentPreviewPage,
    pageSize: previewPageSize,
    previewFilter,
    groupKey: activeIssueGroupKey,
  });
  const uploadImport = useUploadEmployeeImport();
  const validateImport = useValidateEmployeeImport();
  const applyImport = useApplyEmployeeImport();
  const downloadTemplate = useDownloadEmployeeImportTemplate();
  const {
    data: historyPage,
    error: historyError,
    isLoading: isHistoryLoading,
    refetch: refetchHistoryPage,
  } = useEmployeeImportHistory({
    pageNumber: historyPageNumber,
    pageSize: HISTORY_PAGE_SIZE,
  });

  const activeSchema = session?.employeeImportSchema ?? schema;
  const validationUi = useMemo(
    () => (session ? buildEmployeeImportValidationUiModel(session) : null),
    [session]
  );
  const hasGroupedIssues =
    session?.stage === "Validated" && (validationUi?.groupCount ?? 0) > 0;
  const sessionViewResetKey = session
    ? `${session.id}:${session.stage}:${session.version}`
    : null;
  const focusedGroup = useMemo(
    () =>
      activeIssueGroupKey && validationUi
        ? (validationUi.groupedIssues.find(
            (group) => group.key === activeIssueGroupKey
          ) ?? null)
        : null,
    [activeIssueGroupKey, validationUi]
  );
  const displayedPreviewRows = session?.previewRows ?? [];
  const isAppliedSession = session?.stage === "Applied";
  const isPreviewExpanded = !isAppliedSession || isAppliedPreviewOpen;
  const isInitialSessionLoading =
    !!sessionId && isSessionLoading && !session && !sessionError;
  const isInitialImportPageLoading =
    !sessionId && !session && !schema && !schemaError && isSchemaLoading;
  const isInitialPageLoading =
    canAccess && (isInitialImportPageLoading || isInitialSessionLoading);

  useEffect(() => {
    setApplyError(null);
    setLastApplyResult(null);
  }, [session?.id]);

  useEffect(() => {
    setIsAppliedPreviewOpen(!isAppliedSession);
  }, [isAppliedSession, session?.id]);

  useEffect(() => {
    if (!sessionViewResetKey) {
      return;
    }

    const stagePart = sessionViewResetKey.split(":")[1];
    const shouldDefaultToAffectedRows =
      stagePart === "Validated" && (validationUi?.groupCount ?? 0) > 0;

    setPreviewFilter(shouldDefaultToAffectedRows ? "affected" : "all");
    setActiveIssueGroupKey(null);
    setCurrentPreviewPage(1);
    setPendingScrollRowNumber(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionViewResetKey]);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const replaceImportRoute = useCallback(
    (
      nextSessionId: string | null,
      nextHistoryId: string | null,
      hash = ""
    ) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      if (nextSessionId) {
        nextSearchParams.set("session", nextSessionId);
      } else {
        nextSearchParams.delete("session");
      }

      if (nextHistoryId) {
        nextSearchParams.set("historyId", nextHistoryId);
      } else {
        nextSearchParams.delete("historyId");
      }

      const nextSearch = nextSearchParams.toString();
      const nextUrl = `/employees/import${nextSearch ? `?${nextSearch}` : ""}${hash}`;
      router.replace(nextUrl);
    },
    [router, searchParams]
  );

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadTemplate.mutateAsync(undefined);
      downloadBlob(blob, "employee-import-template.csv");
      toast.success("Employee import template downloaded.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [downloadTemplate]);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      try {
        const nextSession = await uploadImport.mutateAsync({
          file,
          batchEffectiveDate: `${batchEffectiveDate}T00:00:00.000Z`,
          importMode,
        });
        replaceImportRoute(nextSession.id, null);
        toast.success("Employee import preview created.");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [batchEffectiveDate, importMode, replaceImportRoute, uploadImport]
  );

  const handleValidateSession = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      await validateImport.mutateAsync({
        sessionId: session.id,
        pageNumber: currentPreviewPage,
        pageSize: previewPageSize,
        previewFilter,
        groupKey: activeIssueGroupKey,
      });
      await refetchSession();
      setApplyError(null);

      if (session.stage === "Validated") {
        toast.success("Employee import validation refreshed.");
      } else {
        toast.success("Employee import validation completed.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [
    activeIssueGroupKey,
    currentPreviewPage,
    previewPageSize,
    previewFilter,
    refetchSession,
    session,
    validateImport,
  ]);

  const handleApplySession = useCallback(async () => {
    if (!session) {
      return false;
    }

    try {
      setApplyError(null);
      const result = await applyImport.mutateAsync({ sessionId: session.id });
      setLastApplyResult(result);
      replaceImportRoute(session.id, null);
      const shouldRefetchCurrentHistoryPage = historyPageNumber === 1;
      setHistoryPageNumber(1);

      await refetchSession();

      if (shouldRefetchCurrentHistoryPage) {
        await refetchHistoryPage();
      }

      toast.success("Employee import applied.");
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      setApplyError(message);
      toast.error(message);
      return false;
    }
  }, [
    applyImport,
    historyPageNumber,
    replaceImportRoute,
    refetchHistoryPage,
    refetchSession,
    session,
  ]);

  const scrollToPreviewRow = useCallback((rowNumber: number) => {
    requestAnimationFrame(() => {
      document
        .getElementById(`employee-import-preview-row-${rowNumber}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (pendingScrollRowNumber === null || !session) {
      return;
    }

    const rowExists = session.previewRows.some(
      (row) => row.rowNumber === pendingScrollRowNumber
    );

    if (!rowExists) {
      return;
    }

    scrollToPreviewRow(pendingScrollRowNumber);
    setPendingScrollRowNumber(null);
  }, [pendingScrollRowNumber, scrollToPreviewRow, session]);

  const handleSelectGroup = useCallback(
    (group: EmployeeImportIssueGroup) => {
      const isSameGroup = activeIssueGroupKey === group.key;
      setPreviewFilter("affected");
      setCurrentPreviewPage(1);

      if (isSameGroup) {
        setActiveIssueGroupKey(null);
        setPendingScrollRowNumber(null);
        return;
      }

      setActiveIssueGroupKey(group.key);
      const firstPreviewRow = group.rowNumbers[0];

      if (firstPreviewRow !== undefined) {
        setPendingScrollRowNumber(firstPreviewRow);
      }
    },
    [activeIssueGroupKey]
  );

  const handleJumpToRow = useCallback(
    (rowNumber: number) => {
      const pageSize =
        session?.previewPageSize ?? DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE;
      const sortedRowNumbers = focusedGroup?.rowNumbers
        ? [...focusedGroup.rowNumbers].sort((left, right) => left - right)
        : [];
      const targetRowIndex = sortedRowNumbers.findIndex(
        (candidateRowNumber) => candidateRowNumber === rowNumber
      );

      if (targetRowIndex >= 0) {
        setCurrentPreviewPage(Math.floor(targetRowIndex / pageSize) + 1);
        setPendingScrollRowNumber(rowNumber);
        return;
      }

      scrollToPreviewRow(rowNumber);
    },
    [focusedGroup, scrollToPreviewRow, session?.previewPageSize]
  );

  const handlePreviewFilterChange = useCallback(
    (nextPreviewFilter: EmployeeImportPreviewFilter) => {
      setPreviewFilter(nextPreviewFilter);
      setActiveIssueGroupKey(null);
      setCurrentPreviewPage(1);
      setPendingScrollRowNumber(null);
    },
    []
  );

  const handlePreviewPageChange = useCallback(
    (nextPageNumber: number) => {
      if (!session) {
        return;
      }

      const clampedPageNumber = Math.min(
        Math.max(nextPageNumber, 1),
        session.previewPageCount
      );

      if (clampedPageNumber === currentPreviewPage) {
        return;
      }

      setCurrentPreviewPage(clampedPageNumber);
      setPendingScrollRowNumber(null);
      requestAnimationFrame(() => {
        document
          .getElementById("employee-import-preview")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    },
    [currentPreviewPage, session]
  );

  const handlePreviewPageSizeChange = useCallback(
    (nextPageSize: PageSize) => {
      if (nextPageSize === previewPageSize) {
        return;
      }

      setPreviewPageSize(nextPageSize);
      setCurrentPreviewPage(1);
      setPendingScrollRowNumber(null);
    },
    [previewPageSize]
  );

  const handleHistoryPageChange = useCallback(
    (nextPageNumber: number) => {
      if (!historyPage) {
        return;
      }

      const clampedPageNumber = Math.min(
        Math.max(nextPageNumber, 1),
        historyPage.pageCount
      );

      if (clampedPageNumber === historyPageNumber) {
        return;
      }

      setHistoryPageNumber(clampedPageNumber);
    },
    [historyPage, historyPageNumber]
  );

  if (isInitialPageLoading) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title="Import employees"
          description="Upload and validate from the CSV template."
        />
        <PageLoading rows={6} label="Loading employee import..." />
      </PageContainer>
    );
  }

  if (!canAccess) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title="Import employees"
          description="Import access is restricted."
        />
        <PagePermissionNotice
          title="Employee import is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      width="wide"
      className="space-y-6 [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_summary]:cursor-pointer"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        title="Import employees"
        description="Upload, review, and apply CSV employee data."
        actions={
          <Button variant="outline" asChild>
            <Link href="/employees">
              <ArrowLeft />
              Back to employees
            </Link>
          </Button>
        }
      />

      {(schemaError || sessionError) && (
        <Alert variant="destructive">
          <AlertTitle>Employee import request failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{getErrorMessage(schemaError ?? sessionError)}</span>
            {sessionId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchSession()}
              >
                <RefreshCcw />
                Retry session
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {!isAppliedSession ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Batch settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-effective-date">Effective date</Label>
                <Input
                  id="batch-effective-date"
                  type="date"
                  value={
                    session?.batchEffectiveDate
                      ? session.batchEffectiveDate.slice(0, 10)
                      : batchEffectiveDate
                  }
                  onChange={(e) => setBatchEffectiveDate(e.target.value)}
                  disabled={!!session || uploadImport.isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Applied to all rows without a row-level effective date.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-mode">Import mode</Label>
                <Select
                  value={session?.importMode ?? importMode}
                  onValueChange={(v) => setImportMode(v as EmployeeImportMode)}
                  disabled={!!session || uploadImport.isLoading}
                >
                  <SelectTrigger id="import-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BusinessChange">
                      Business change — adds new records
                    </SelectItem>
                    <SelectItem value="Correction">
                      Correction — updates existing records only
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Correction mode rejects new employee rows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <>
          {isAppliedSession ? (
            <AppliedResultPanel
              session={session}
              applyResult={lastApplyResult}
              onUpload={handleBrowse}
            />
          ) : (
            <BatchActionPanel
              session={session}
              isValidating={validateImport.isLoading}
              isUploading={uploadImport.isLoading}
              isDownloadingTemplate={downloadTemplate.isLoading}
              isApplying={applyImport.isLoading}
              applyError={applyError}
              onValidate={handleValidateSession}
              onUpload={handleBrowse}
              onDownloadTemplate={handleDownloadTemplate}
              onApply={handleApplySession}
            />
          )}

          {isAppliedSession ? (
            <ImportHistoryPanel
              historyPage={historyPage}
              isHistoryLoading={isHistoryLoading}
              historyError={historyError}
              onPageChange={handleHistoryPageChange}
            />
          ) : null}

          <div
            className={
              hasGroupedIssues && validationUi
                ? "grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start"
                : "grid gap-4"
            }
          >
            {hasGroupedIssues && validationUi ? (
              <IssueNavigatorPanel
                model={validationUi}
                activeGroupKey={activeIssueGroupKey}
                onSelectGroup={handleSelectGroup}
              />
            ) : null}

            <Card id="employee-import-preview">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>Preview</CardTitle>
                  {isAppliedSession ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setIsAppliedPreviewOpen((current) => !current)
                      }
                    >
                      {isAppliedPreviewOpen ? "Hide preview" : "Show preview"}
                    </Button>
                  ) : hasGroupedIssues ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewFilter === "all" ? "default" : "outline"
                        }
                        onClick={() => handlePreviewFilterChange("all")}
                      >
                        All rows
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewFilter === "affected" ? "default" : "outline"
                        }
                        onClick={() => handlePreviewFilterChange("affected")}
                      >
                        Rows with issues only
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              {isPreviewExpanded ? (
                <CardContent>
                  {hasGroupedIssues ? (
                    <div className="">
                      <SelectedIssueStrip
                        group={focusedGroup}
                        onJumpToRow={handleJumpToRow}
                      />
                    </div>
                  ) : null}

                  <EmployeeImportPreviewTable
                    rows={displayedPreviewRows}
                    hasGroupedIssues={hasGroupedIssues}
                    validationUi={validationUi}
                    focusedGroup={focusedGroup}
                    activeIssueGroupKey={activeIssueGroupKey}
                    onSelectGroup={handleSelectGroup}
                  />
                  <div className="mt-4">
                    <PreviewPagination
                      pageNumber={session.previewPageNumber}
                      pageCount={session.previewPageCount}
                      pageSize={session.previewPageSize}
                      onPageChange={handlePreviewPageChange}
                      onPageSizeChange={handlePreviewPageSizeChange}
                    />
                  </div>
                </CardContent>
              ) : null}

            </Card>
          </div>

          {!isAppliedSession ? (
            <ImportHistoryPanel
              historyPage={historyPage}
              isHistoryLoading={isHistoryLoading}
              historyError={historyError}
              onPageChange={handleHistoryPageChange}
            />
          ) : null}

          <SecondaryDetailsPanel
            key={session ? `${session.id}:${session.stage}` : "empty-session"}
            activeSchema={activeSchema}
            isSchemaLoading={isSchemaLoading}
          />
        </>
      ) : (
        <>
          <EmptyImportState
            isUploading={uploadImport.isLoading}
            isDownloadingTemplate={downloadTemplate.isLoading}
            onUpload={handleBrowse}
            onDownloadTemplate={handleDownloadTemplate}
          />

          <ImportHistoryPanel
            historyPage={historyPage}
            isHistoryLoading={isHistoryLoading}
            historyError={historyError}
            onPageChange={handleHistoryPageChange}
          />

          <SecondaryDetailsPanel
            key="empty-session"
            activeSchema={activeSchema}
            isSchemaLoading={isSchemaLoading}
          />
        </>
      )}
    </PageContainer>
  );
}
