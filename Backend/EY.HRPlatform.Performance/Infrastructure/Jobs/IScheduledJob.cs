namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// A named recurring background job hosted by <see cref="ScheduledJobRunner"/>. Each job owns its
/// own tenant discovery and per-tenant DI scopes (so global tenant query filters and the tenant save
/// interceptor apply); the runner owns the timer loop, enable/disable, the single-run advisory lock,
/// and run-history recording.
/// </summary>
public interface IScheduledJob
{
    /// <summary>Stable job name; also the advisory-lock and ledger key.</summary>
    string Name { get; }

    /// <summary>How often the runner ticks this job. A non-positive interval disables the job.</summary>
    TimeSpan Interval { get; }

    /// <summary>Runs one sweep across all relevant tenants and returns the number of items affected.</summary>
    Task<int> ExecuteAsync(CancellationToken cancellationToken);
}
