using System.Text.RegularExpressions;
using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// The demo clock (performance-demo-clock): one source of "now", scoped to the async flow that
/// set it, and no Performance code reading the system time around it.
/// </summary>
public sealed class PerformanceClockTests
{
    private static readonly DateTime Past = new(2025, 3, 14, 9, 30, 0, DateTimeKind.Utc);

    [Fact]
    public void Travel_applies_inside_its_scope_only()
    {
        Assert.False(PerformanceClock.IsSimulated);
        using (PerformanceClock.Travel(Past))
        {
            Assert.True(PerformanceClock.IsSimulated);
            Assert.Equal(Past, PerformanceClock.UtcNow);
            Assert.Equal(new DateOnly(2025, 3, 14), PerformanceClock.Today);
        }

        Assert.False(PerformanceClock.IsSimulated);
        Assert.True((DateTime.UtcNow - PerformanceClock.UtcNow).Duration() < TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Travel_requires_a_utc_instant()
        => Assert.Throws<ArgumentException>(() => PerformanceClock.Travel(new DateTime(2025, 3, 14, 9, 30, 0, DateTimeKind.Local)));

    [Fact]
    public async Task Concurrent_flows_keep_their_own_time()
    {
        using var entered = new SemaphoreSlim(0);
        using var release = new SemaphoreSlim(0);

        var simulated = Task.Run(async () =>
        {
            using var _ = PerformanceClock.Travel(Past);
            entered.Release();
            await release.WaitAsync();
            return PerformanceClock.UtcNow;
        });

        await entered.WaitAsync();
        var other = await Task.Run(() => PerformanceClock.UtcNow);
        release.Release();

        Assert.Equal(Past, await simulated);
        Assert.True((DateTime.UtcNow - other).Duration() < TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Performance_source_reads_time_only_through_the_clock()
    {
        var source = Path.Combine(BackendDirectory(), "EY.HRPlatform.Performance");
        var systemTime = new Regex(@"\bDateTime(Offset)?\.(UtcNow|Now|Today)\b");
        var offenders = Directory.EnumerateFiles(source, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(path) && Path.GetFileName(path) != "PerformanceClock.cs")
            .SelectMany(path => File.ReadLines(path)
                .Select((line, index) => (line, index))
                .Where(entry => systemTime.IsMatch(entry.line))
                .Select(entry => $"{Path.GetRelativePath(source, path)}:{entry.index + 1}"))
            .ToList();

        Assert.True(offenders.Count == 0, $"Use PerformanceClock instead of the system time: {string.Join(", ", offenders)}");
    }

    private static bool IsBuildOutput(string path)
    {
        var parts = path.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return parts.Contains("bin") || parts.Contains("obj");
    }

    private static string BackendDirectory()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
            if (Directory.Exists(Path.Combine(directory.FullName, "EY.HRPlatform.Performance")))
                return directory.FullName;
        throw new InvalidOperationException("Backend source directory not found from the test output.");
    }
}
