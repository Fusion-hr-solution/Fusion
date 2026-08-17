using System.Threading;

namespace EY.HRPlatform.CoreHR.Tests;

/// <summary>
/// Supplies unique, tenant-safe Employee Numbers for test fixtures that seed
/// <see cref="EY.HRPlatform.CoreHR.Domain.Entities.Employee"/> directly. Production code
/// allocates numbers through the workforce Employee Number allocator; tests only need a
/// distinct value that satisfies the canonical "every Employee has a number" invariant.
/// </summary>
public static class TestEmployeeNumbers
{
    private static int _sequence;

    public static string Next() => $"E{Interlocked.Increment(ref _sequence):D6}";
}
