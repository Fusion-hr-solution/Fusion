using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Raised when Core HR cannot be reached or answered with a server fault — a timeout, an open
/// circuit, a transport failure, or a 5xx. Distinct from a Core HR answer that says "not found"
/// or "forbidden", which are legitimate outcomes rather than dependency failures.
/// </summary>
/// <remarks>
/// This exists so a Core HR outage surfaces as a recoverable, retryable outcome instead of a
/// partial result. Nothing in Performance may freeze a participant baseline, compute readiness,
/// or report a population count from an incomplete workforce read.
/// </remarks>
public sealed class CoreWorkforceUnavailableException(string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public Error ToError() => PerformanceDependencyErrors.CoreWorkforceUnavailable(Message);
}

/// <summary>Error codes for failures caused by a dependency rather than by the caller.</summary>
public static class PerformanceDependencyErrors
{
    /// <summary>
    /// The caller did nothing wrong and the same request may succeed later. Clients surface this
    /// as "temporarily unavailable, retry" rather than as a validation or permission problem.
    /// </summary>
    public const string CoreWorkforceUnavailableCode = "Performance.Dependency.CoreWorkforceUnavailable";

    public static Error CoreWorkforceUnavailable(string? detail = null) => new(
        CoreWorkforceUnavailableCode,
        "Core HR is temporarily unavailable, so workforce data could not be read. No changes were made. Try again shortly.",
        detail is null ? null : new { detail });

    public static Result<T> Failure<T>(string? detail = null) =>
        Result.Failure<T>(CoreWorkforceUnavailable(detail));
}
