import { toast } from "sonner";
import { ApiError } from "@repo/api";

export function performanceFailure(error: unknown) {
  const kind = error instanceof ApiError ? error.failureKind : null;
  return {
    kind,
    unavailable: kind === "Forbidden",
    refresh: kind === "Stale" || kind === "InvalidState" || kind === "Forbidden",
    message: kind === "Stale" ? "This changed since you opened it"
      : kind === "Forbidden" ? "This record is not available"
      : error instanceof Error ? error.message : "Could not complete this action.",
  };
}

const reported = new WeakSet<Error>();

export function reportPerformanceFailure(error: unknown, fallback = "Could not complete this action.") {
  if (error instanceof Error && reported.has(error)) return;
  if (error instanceof Error) reported.add(error);
  const failure = performanceFailure(error);
  toast.error(error instanceof Error ? failure.message : fallback);
}

export async function recoverPerformanceFailure(error: unknown, refresh: () => Promise<unknown>) {
  const failure = performanceFailure(error);
  if (failure.refresh) await refresh();
  if (failure.kind) reportPerformanceFailure(error);
}
