using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Interview.Features.Grading.FrontendRunner;

/// <summary>
/// Runs a Frontend Project's tests in a hardened, ephemeral Docker container. Untrusted candidate
/// code executes here, so every run is locked down: dropped capabilities, no privilege escalation,
/// read-only root fs (with tmpfs scratch), CPU/memory/pids caps, a wall-clock kill, and (by default)
/// NO network — the framework's node_modules are baked into the per-framework image so no
/// install/registry is needed.
///
/// Image contract (see docker/frontend-runner/ for the reference images): the candidate submission
/// is mounted read-only at <c>/submission</c>; the image entrypoint assembles it in the writable
/// tmpfs <c>/work</c> (source + author tests, node_modules symlinked from the read-only image
/// layer), runs the framework test runner with a <b>JSON</b> reporter (Jest's schema, emitted by
/// both Vitest and Jest), and parses it into a final line
/// <c>##RESULT##{"total":N,"passed":M}</c> then exits 0. Exit 2 signals an install/setup failure.
/// JSON — not JUnit — because it lets the image distinguish a suite that never collected any tests
/// (a compile error → <c>{"total":0,...}</c> → this grader routes to human review) from one whose
/// tests genuinely failed. The counts we consume here are already resolved by that in-image logic.
/// </summary>
public sealed class DockerFrontendProjectRunner(
    IOptions<FrontendRunnerOptions> options,
    ILogger<DockerFrontendProjectRunner> logger) : IFrontendProjectRunner
{
    private const string ResultMarker = "##RESULT##";
    private readonly FrontendRunnerOptions _options = options.Value;

    public async Task<FrontendRunResult> RunAsync(FrontendRunRequest request, CancellationToken cancellationToken)
    {
        if (!_options.Images.TryGetValue(request.Framework, out var image) || string.IsNullOrWhiteSpace(image))
        {
            logger.LogWarning("No Frontend runner image configured for framework {Framework}.", request.Framework);
            return new FrontendRunResult(FrontendRunStatus.Error, -1, null, null, $"No runner image for '{request.Framework}'.");
        }

        var workDir = Path.Combine(Path.GetTempPath(), "interview-fe", Guid.NewGuid().ToString("N"));
        var containerName = $"interview-fe-{Guid.NewGuid():N}";
        try
        {
            MaterializeFiles(request.Files, workDir);

            var args = BuildDockerArgs(image, containerName, workDir);
            return await ExecuteAsync(containerName, args, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Frontend runner failed to execute container.");
            return new FrontendRunResult(FrontendRunStatus.Error, -1, null, null, ex.Message);
        }
        finally
        {
            TryDelete(workDir);
        }
    }

    // ── Materialize the merged project safely to a temp dir ───────────────────────────────
    private void MaterializeFiles(IReadOnlyList<FrontendRunFile> files, string root)
    {
        if (files.Count == 0)
            throw new InvalidOperationException("No files to run.");
        if (files.Count > _options.MaxFiles)
            throw new InvalidOperationException($"Too many files (max {_options.MaxFiles}).");

        Directory.CreateDirectory(root);
        var total = 0;
        foreach (var file in files)
        {
            var full = ResolveSafePath(root, file.Path);
            var content = file.Content ?? string.Empty;
            total += Encoding.UTF8.GetByteCount(content);
            if (total > _options.MaxTotalBytes)
                throw new InvalidOperationException($"Project is too large (max {_options.MaxTotalBytes / 1024} KB).");

            Directory.CreateDirectory(Path.GetDirectoryName(full)!);
            File.WriteAllText(full, content, new UTF8Encoding(false));
        }
    }

    /// <summary>Resolves a candidate-supplied relative path under <paramref name="root"/>, rejecting
    /// traversal/absolute paths — untrusted input is written to disk here, so this is security-critical.</summary>
    private static string ResolveSafePath(string root, string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
            throw new InvalidOperationException("File path is required.");

        var path = rawPath.Trim().Replace('\\', '/');
        if (path.StartsWith('/') || (path.Length >= 2 && path[1] == ':'))
            throw new InvalidOperationException($"File path must be relative: {path}");

        foreach (var segment in path.Split('/'))
        {
            if (segment.Length == 0 || segment is "." or "..")
                throw new InvalidOperationException($"Invalid file path: {path}");
        }

        var full = Path.GetFullPath(Path.Combine(root, path));
        var rootFull = Path.GetFullPath(root) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(rootFull, StringComparison.Ordinal))
            throw new InvalidOperationException($"File path escapes the working directory: {path}");

        return full;
    }

    // ── Build the hardened `docker run` argument list ─────────────────────────────────────
    // The image's entrypoint runs a fixed, JSON-reporting test command chosen by the framework, so
    // no command is passed in here — see FrontendRunRequest / docker/frontend-runner/entrypoint.sh.
    private List<string> BuildDockerArgs(string image, string containerName, string workDir)
    {
        return
        [
            "run", "--rm",
            "--name", containerName,
            "--network", _options.Network,
            "--cpus", _options.CpuLimit.ToString(System.Globalization.CultureInfo.InvariantCulture),
            "--memory", $"{_options.MemoryLimitMb}m",
            "--memory-swap", $"{_options.MemoryLimitMb}m", // no swap → hard memory ceiling
            "--pids-limit", _options.PidsLimit.ToString(),
            "--security-opt", "no-new-privileges",
            "--cap-drop", "ALL",
            "--read-only",
            // Writable scratch (RAM-backed, size-capped) — /work assembles the project, /tmp holds
            // caches + the JSON report. node_modules stays on the read-only image layer.
            "--tmpfs", "/work:rw,size=96m,mode=1777",
            "--tmpfs", "/tmp:rw,size=256m,mode=1777",
            "-v", $"{workDir}:/submission:ro",
            image,
        ];
    }

    private async Task<FrontendRunResult> ExecuteAsync(string containerName, List<string> args, CancellationToken cancellationToken)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _options.DockerPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in args)
            psi.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = psi };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        process.OutputDataReceived += (_, e) => { if (e.Data is not null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Wall-clock timeout: force-remove the container so it can't linger, and report Timeout.
            await ForceRemoveContainerAsync(containerName);
            return new FrontendRunResult(FrontendRunStatus.Timeout, -1, null, null, Tail(stdout, stderr));
        }

        var exitCode = process.ExitCode;
        var output = Tail(stdout, stderr);

        return exitCode switch
        {
            0 => ParseRanResult(stdout.ToString(), output),
            2 => new FrontendRunResult(FrontendRunStatus.InstallFailed, exitCode, null, null, output),
            _ => new FrontendRunResult(FrontendRunStatus.Error, exitCode, null, null, output),
        };
    }

    private static FrontendRunResult ParseRanResult(string rawStdout, string output)
    {
        var (total, passed) = ParseResultMarker(rawStdout);
        return new FrontendRunResult(FrontendRunStatus.Ran, 0, total, passed, output);
    }

    /// <summary>Finds the last <c>##RESULT##{...}</c> line and parses the test counts from it.</summary>
    private static (int? Total, int? Passed) ParseResultMarker(string stdout)
    {
        foreach (var line in stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries).Reverse())
        {
            var trimmed = line.Trim();
            var idx = trimmed.IndexOf(ResultMarker, StringComparison.Ordinal);
            if (idx < 0)
                continue;
            try
            {
                using var doc = JsonDocument.Parse(trimmed[(idx + ResultMarker.Length)..]);
                var root = doc.RootElement;
                int? total = root.TryGetProperty("total", out var t) && t.TryGetInt32(out var tv) ? tv : null;
                int? passed = root.TryGetProperty("passed", out var p) && p.TryGetInt32(out var pv) ? pv : null;
                return (total, passed);
            }
            catch (JsonException)
            {
                return (null, null);
            }
        }
        return (null, null);
    }

    private async Task ForceRemoveContainerAsync(string containerName)
    {
        try
        {
            using var kill = Process.Start(new ProcessStartInfo
            {
                FileName = _options.DockerPath,
                ArgumentList = { "rm", "-f", containerName },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (kill is not null)
                await kill.WaitForExitAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to force-remove timed-out container {Container}.", containerName);
        }
    }

    private static string Tail(StringBuilder stdout, StringBuilder stderr)
    {
        var combined = stdout.ToString() + stderr.ToString();
        return combined.Length <= 8000 ? combined : combined[^8000..];
    }

    private static void TryDelete(string dir)
    {
        try
        {
            if (Directory.Exists(dir))
                Directory.Delete(dir, recursive: true);
        }
        catch
        {
            // Best effort — a leftover temp dir is harmless and cleaned by the OS eventually.
        }
    }
}
