namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Timeouts, retry, and circuit-breaker settings for the two Core HR client policies.
/// Bound from configuration so a slow tenant is a settings change, not a redeploy.
/// </summary>
public sealed class CoreWorkforceResilienceOptions
{
    public const string SectionName = "CoreWorkforceResilience";

    /// <summary>Per-request lookups on an interactive request path: short, retried, breaker-guarded.</summary>
    public CoreWorkforcePolicyOptions Interactive { get; set; } = new()
    {
        AttemptTimeoutSeconds = 10,
        TotalTimeoutSeconds = 30,
        MaxRetryAttempts = 2,
        RetryDelaySeconds = 1,
        CircuitBreakerSamplingDurationSeconds = 60,
        CircuitBreakerBreakDurationSeconds = 15,
        CircuitBreakerFailureRatio = 0.5,
        CircuitBreakerMinimumThroughput = 10
    };

    /// <summary>
    /// Full-workforce resolution during population preview and campaign launch: long, and never
    /// retried — a retried full-population resolve doubles load on an already-struggling Core HR.
    /// </summary>
    public CoreWorkforcePolicyOptions Bulk { get; set; } = new()
    {
        AttemptTimeoutSeconds = 120,
        TotalTimeoutSeconds = 180,
        MaxRetryAttempts = 0,
        RetryDelaySeconds = 1,
        CircuitBreakerSamplingDurationSeconds = 300,
        CircuitBreakerBreakDurationSeconds = 30,
        CircuitBreakerFailureRatio = 0.5,
        CircuitBreakerMinimumThroughput = 4
    };
}

public sealed class CoreWorkforcePolicyOptions
{
    public int AttemptTimeoutSeconds { get; set; }
    public int TotalTimeoutSeconds { get; set; }

    /// <summary>Zero disables retry entirely.</summary>
    public int MaxRetryAttempts { get; set; }
    public int RetryDelaySeconds { get; set; }
    public int CircuitBreakerSamplingDurationSeconds { get; set; }
    public int CircuitBreakerBreakDurationSeconds { get; set; }
    public double CircuitBreakerFailureRatio { get; set; }
    public int CircuitBreakerMinimumThroughput { get; set; }
}
