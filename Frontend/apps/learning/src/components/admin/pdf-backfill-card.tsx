"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { backfillPdfText } from "@/services/admin-service";
import type { BackfillPdfTextResult } from "@/types/admin";

/** US-8.2.5 — admin maintenance action: extract text from already-uploaded PDFs into the DB. */
export function PdfBackfillCard() {
  const t = useTranslations("adminQuiz");
  const [result, setResult] = useState<BackfillPdfTextResult | null>(null);
  const { mutateAsync, isLoading } = useApiMutation(() => backfillPdfText());

  async function handleRun() {
    try {
      const res = await mutateAsync(undefined);
      setResult(res);
      toast.success(
        t("backfill.done", {
          updated: res.updated,
          scanned: res.scanned,
          skipped: res.skipped,
        }),
      );
    } catch (err) {
      const description =
        err instanceof ApiError ? (err.errors[0] ?? err.message) : undefined;
      toast.error(t("backfill.error"), { description });
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {t("backfill.title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("backfill.description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isLoading}
            className="ey-bg-dark hover:opacity-90"
          >
            {isLoading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            {isLoading ? t("backfill.running") : t("backfill.button")}
          </Button>
          {result && (
            <p className="text-xs text-muted-foreground">
              {t("backfill.done", {
                updated: result.updated,
                scanned: result.scanned,
                skipped: result.skipped,
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
