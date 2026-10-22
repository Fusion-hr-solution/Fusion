namespace EY.HRPlatform.Performance.Domain.Common;

/// <summary>
/// The one source of "now" for Performance. Real time unless a Development request runs under
/// the demo clock (<c>X-Demo-Clock</c>), which sets a simulated instant for that request's async
/// flow only, so seeded history goes through the same rules and stamps as live use.
/// </summary>
public static class PerformanceClock
{
    private static readonly AsyncLocal<DateTime?> Simulated = new();

    public static DateTime UtcNow => Simulated.Value ?? DateTime.UtcNow;

    public static DateOnly Today => DateOnly.FromDateTime(UtcNow);

    /// <summary>Whether the current flow runs at a simulated instant.</summary>
    public static bool IsSimulated => Simulated.Value is not null;

    /// <summary>Runs the current async flow at <paramref name="instantUtc"/> until the scope is disposed.</summary>
    public static IDisposable Travel(DateTime instantUtc)
    {
        if (instantUtc.Kind != DateTimeKind.Utc)
            throw new ArgumentException("The simulated instant must be UTC.", nameof(instantUtc));
        var previous = Simulated.Value;
        Simulated.Value = instantUtc;
        return new Scope(previous);
    }

    private sealed class Scope(DateTime? previous) : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Simulated.Value = previous;
        }
    }
}
