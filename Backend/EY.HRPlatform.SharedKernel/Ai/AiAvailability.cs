namespace EY.HRPlatform.SharedKernel.Ai;

public enum AiAvailabilityState
{
    Available,
    /// <summary>No credentials. Lasts until the process restarts with configuration.</summary>
    NotConfigured,
    /// <summary>The provider refused the credentials. Lasts until the process restarts.</summary>
    Refused,
    /// <summary>The provider kept failing; AI rests until the cooldown ends.</summary>
    CoolingDown,
}

/// <summary>
/// Whether a module should offer AI right now, learned from its own calls. Three consecutive
/// transient failures start a cooldown (extended to the provider's Retry-After, capped); a refused
/// credential or a missing key turns AI off until restart; a success clears the count. Per process.
/// </summary>
public sealed class AiAvailability
{
    public const int FailuresBeforeCooldown = 3;
    public static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(90);
    public static readonly TimeSpan MaxCooldown = TimeSpan.FromMinutes(2);

    private readonly TimeProvider clock;
    private readonly object gate = new();
    private bool refused;
    private int consecutiveFailures;
    private DateTimeOffset? coolingUntil;

    public AiAvailability(bool configured, TimeProvider? clock = null)
    {
        Configured = configured;
        this.clock = clock ?? TimeProvider.System;
    }

    public bool Configured { get; }

    public AiAvailabilityState State
    {
        get
        {
            if (!Configured) return AiAvailabilityState.NotConfigured;
            lock (gate)
            {
                if (refused) return AiAvailabilityState.Refused;
                if (coolingUntil is { } until && clock.GetUtcNow() < until) return AiAvailabilityState.CoolingDown;
                return AiAvailabilityState.Available;
            }
        }
    }

    public bool IsAvailable => State == AiAvailabilityState.Available;

    public void RecordSuccess()
    {
        lock (gate)
        {
            consecutiveFailures = 0;
            coolingUntil = null;
        }
    }

    public void RecordFailure(AiFailureCategory category, DateTime? retryAfter = null)
    {
        lock (gate)
        {
            if (category == AiFailureCategory.Unauthorized)
            {
                refused = true;
                return;
            }
            if (!AiFailures.IsTransient(category) || category == AiFailureCategory.Interrupted) return;

            consecutiveFailures++;
            if (consecutiveFailures < FailuresBeforeCooldown) return;

            var now = clock.GetUtcNow();
            var until = now + Cooldown;
            if (retryAfter is { } retry && new DateTimeOffset(DateTime.SpecifyKind(retry, DateTimeKind.Utc)) > until)
                until = new DateTimeOffset(DateTime.SpecifyKind(retry, DateTimeKind.Utc));
            if (until > now + MaxCooldown) until = now + MaxCooldown;
            coolingUntil = until;
            consecutiveFailures = 0;
        }
    }
}
