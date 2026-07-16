import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { PageContainer, type PageContainerProps } from "./page";

interface BaseStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function StateShell({ icon: Icon, title, description, action, className }: BaseStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Empty state: explains what's missing and what to do next. */
export function PageEmpty(props: BaseStateProps) {
  return <StateShell icon={props.icon ?? Inbox} {...props} />;
}

/** Permission/read-only notice: explains the boundary rather than hiding silently. */
export function PagePermissionNotice(props: Omit<BaseStateProps, "icon">) {
  return <StateShell icon={Lock} {...props} />;
}

export interface PageErrorProps extends Omit<BaseStateProps, "icon" | "action"> {
  onRetry?: () => void;
  retryLabel?: string;
}

/** Constructive error state with an optional retry. */
export function PageError({ title, description, onRetry, retryLabel = "Try again", className }: PageErrorProps) {
  return (
    <StateShell
      icon={AlertTriangle}
      title={title}
      description={description}
      className={className}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export interface PageLoadingProps {
  /** Number of skeleton rows for list-style loading. */
  rows?: number;
  className?: string;
  label?: string;
}

/** Calm, specific loading state (skeleton rows). */
export function PageLoading({ rows = 5, className, label }: PageLoadingProps) {
  return (
    <div className={cn("space-y-2", className)} aria-busy aria-label={label ?? "Loading"}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export interface PageSkeletonProps {
  /** Number of content skeleton rows below the header placeholder. */
  rows?: number;
  width?: PageContainerProps["width"];
  label?: string;
}

/**
 * Neutral in-frame page fallback: header-shaped placeholder + content rows.
 * Title-less by design — never fakes a page name. Use for route-level
 * loading boundaries and access-resolution holds inside the app shell.
 */
export function PageSkeleton({ rows = 6, width = "default", label }: PageSkeletonProps) {
  return (
    <PageContainer width={width}>
      <div aria-busy aria-label={label ?? "Loading page"}>
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <PageLoading rows={rows} label={label} />
      </div>
    </PageContainer>
  );
}
