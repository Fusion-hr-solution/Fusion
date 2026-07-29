"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  CreatePerformanceCycleRequest,
  PerformanceCycleDetailDto,
} from "@repo/api";
import { useApiMutation, useApiQueryClient } from "@repo/api/query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { campaignCreateDialog } from "./campaign-terminology";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from(
  { length: 8 },
  (_, index) => currentYear + index
);

interface CampaignCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignCreateDialog({
  open,
  onOpenChange,
}: CampaignCreateDialogProps) {
  const router = useRouter();
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();
  const [name, setName] = useState("");
  const [year, setYear] = useState(currentYear);
  const [error, setError] = useState<string | null>(null);

  const create = useApiMutation<
    PerformanceCycleDetailDto,
    CreatePerformanceCycleRequest
  >(
    (request) =>
      apiClient.post<PerformanceCycleDetailDto>(
        performancePaths.cycles(),
        request
      ),
    {
      onSuccess: (campaign) => {
        // Prime the workspace's detail cache so it paints immediately — no skeleton flash.
        queryClient.setQueryData(
          performanceQueryKeys.cycleBySlug(campaign.slug),
          campaign
        );
        // Refresh the list only, so the seeded detail stays fresh (no redundant refetch).
        queryClient.invalidateQueries({
          queryKey: [...performanceQueryKeys.cycles(), "list"],
        });
        toast.success("Campaign created");
        handleOpenChange(false);
        router.push(`/campaigns/${campaign.slug}`);
      },
      onError: (err) => setError(toCreateError(err)),
    }
  );

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !create.isLoading;
  const preview = slugPreview(trimmed, year);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setYear(currentYear);
      setError(null);
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    setError(null);
    create.mutate(mintRequest(trimmed, year));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{campaignCreateDialog.title}</DialogTitle>
          <DialogDescription>
            {campaignCreateDialog.description}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">
              {campaignCreateDialog.nameLabel}
            </Label>
            <Input
              id="campaign-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={campaignCreateDialog.namePlaceholder}
              className="h-11 text-base"
              aria-invalid={!!error}
              autoComplete="off"
            />
            <p
              className="h-4 truncate font-mono text-xs text-muted-foreground"
              aria-hidden={!preview}
            >
              {preview ? `→ ${preview}` : ""}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>{campaignCreateDialog.yearLabel}</Label>
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-max"
                value={String(year)}
                onValueChange={(value) => {
                  if (value) {
                    setYear(Number(value));
                  }
                }}
              >
                {yearOptions.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={String(option)}
                    className="px-3.5 tabular-nums"
                  >
                    {option}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={create.isLoading}
            >
              {campaignCreateDialog.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {create.isLoading ? (
                <>
                  <Spinner className="mr-1" />
                  {campaignCreateDialog.submitting}
                </>
              ) : (
                <>
                  {campaignCreateDialog.submit}
                  <ArrowRight className="ml-0.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mint request: the dialog only asks for name + year, but the campaign is born with a
 * sensible default schedule (derived from the year) so it lands in the workspace with a
 * truthful, applied schedule to tune — not a blank one.
 */
function mintRequest(
  name: string,
  year: number
): CreatePerformanceCycleRequest {
  const today = localDateAtUtcMidnight(new Date());

  return {
    name,
    purpose: null,
    referenceYear: year,
    planningOpeningDate: today,
    employeeSubmissionDeadline: today,
    managerApprovalDeadline: today,
    expectedPlanningLockDate: today,
  };
}

function localDateAtUtcMidnight(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

/** Approximate the tenant-unique slug the server will mint (final value is authoritative on collision). */
function slugPreview(name: string, year: number): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${year}` : "";
}

function toCreateError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return campaignCreateDialog.permissionDenied;
    }
    // Duplicate-name (409) and validation errors carry a usable server message.
    return (
      error.errors[0] ?? error.message ?? campaignCreateDialog.duplicateFallback
    );
  }
  return error.message;
}
