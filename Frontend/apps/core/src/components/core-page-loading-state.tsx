"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CorePageLoadingStateVariant =
  | "list"
  | "summary-list"
  | "workspace"
  | "dashboard"
  | "redirect";

interface CorePageLoadingStateProps {
  title: string;
  description: string;
  message: string;
  variant?: CorePageLoadingStateVariant;
}

export function CorePageLoadingState({
  title,
  description,
  message,
  variant = "list",
}: CorePageLoadingStateProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={title} description={description} />
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
      {variant === "dashboard" ? (
        <CoreDashboardSkeleton />
      ) : variant === "redirect" ? (
        <CoreRedirectSkeleton />
      ) : variant === "workspace" ? (
        <CoreWorkspaceSkeleton />
      ) : (
        <CoreListPageSkeleton showSummaryCards={variant === "summary-list"} />
      )}
    </div>
  );
}

function CoreRedirectSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function CoreListPageSkeleton({
  showSummaryCards = false,
}: {
  showSummaryCards?: boolean;
}) {
  return (
    <>
      {showSummaryCards ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-10 w-full lg:max-w-sm" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function CoreDashboardSkeleton() {
  return (
    <Card className="py-0">
      <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            <Skeleton className="h-7 w-36 rounded-full" />
            <Skeleton className="h-8 w-full max-w-3xl" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="border-dashed bg-muted/10 shadow-none">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function CoreWorkspaceSkeleton() {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-36" />
              </div>
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
