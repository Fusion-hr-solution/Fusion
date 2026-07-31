using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.CheckIns;

/// <summary>Shared conflict errors for optimistic-concurrency failures across check-in commands.</summary>
public static class CheckInConflicts
{
    public static Error Stale() => Error.Conflict(
        "CheckIn.ConcurrentUpdate",
        "This check-in changed while you were working on it. Refresh and try again.");

    public static Error ActionStale() => Error.Conflict(
        "CheckIn.ActionConcurrentUpdate",
        "This follow-up action changed while you were working on it. Refresh and try again.");
}
