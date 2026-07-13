namespace EY.HRPlatform.Interview.Features.Grading.FrontendRunner;

/// <summary>A single file materialized into the runner's working directory.</summary>
public sealed record FrontendRunFile(string Path, string Content);

/// <summary>A request to run a Frontend Project's test suite: the merged candidate source +
/// author's (hidden) test files, the framework, and the test command.</summary>
public sealed record FrontendRunRequest(
    string Framework,
    IReadOnlyList<FrontendRunFile> Files,
    string TestCommand);

public enum FrontendRunStatus
{
    /// <summary>The test command executed to completion (whether or not every test passed).</summary>
    Ran,

    /// <summary>Dependency install failed before tests could run.</summary>
    InstallFailed,

    /// <summary>The run exceeded the wall-clock limit and was killed.</summary>
    Timeout,

    /// <summary>The runner itself failed (Docker unavailable, image missing, unexpected crash).</summary>
    Error,
}

/// <summary>
/// Result of executing a project's tests. When the runner can parse a report,
/// <see cref="TestsTotal"/>/<see cref="TestsPassed"/> are populated for partial credit; otherwise
/// the grader falls back to the binary <see cref="ExitCode"/> (0 = all passed).
/// </summary>
public sealed record FrontendRunResult(
    FrontendRunStatus Status,
    int ExitCode,
    int? TestsTotal,
    int? TestsPassed,
    string? Output);

/// <summary>
/// Executes a Frontend Project's tests in a sandboxed, network-isolated environment. The
/// authoritative auto-grading path — the candidate's code runs server-side against the author's
/// hidden tests, so the score can't be tampered with client-side. Implemented by
/// <see cref="DockerFrontendProjectRunner"/>; abstracted so it can be swapped for an HTTP runner
/// service without touching the grader.
/// </summary>
public interface IFrontendProjectRunner
{
    Task<FrontendRunResult> RunAsync(FrontendRunRequest request, CancellationToken cancellationToken);
}

/// <summary>Configuration for the Docker-backed Frontend Project runner (section "FrontendRunner").</summary>
public sealed class FrontendRunnerOptions
{
    public const string SectionName = "FrontendRunner";

    /// <summary>Master switch. When false, no runner/grader is registered and Frontend Project
    /// questions fall through to human review.</summary>
    public bool Enabled { get; set; }

    /// <summary>Path to the docker CLI (or a compatible shim).</summary>
    public string DockerPath { get; set; } = "docker";

    /// <summary>framework ("react"|"angular"|"next") → pre-built image with node_modules baked in.</summary>
    public Dictionary<string, string> Images { get; set; } = new();

    /// <summary>Docker network to attach. "none" = fully isolated (recommended when deps are baked
    /// into the image); otherwise an internal network routing only to a private npm mirror.</summary>
    public string Network { get; set; } = "none";

    public double CpuLimit { get; set; } = 1.0;
    // Node test runners + the tmpfs scratch need headroom.
    public int MemoryLimitMb { get; set; } = 1024;
    public int PidsLimit { get; set; } = 256;
    public int TimeoutSeconds { get; set; } = 120;

    // Bounds on what we'll materialize to disk (defense against abuse).
    public int MaxFiles { get; set; } = 80;
    public int MaxTotalBytes { get; set; } = 512 * 1024;
}
