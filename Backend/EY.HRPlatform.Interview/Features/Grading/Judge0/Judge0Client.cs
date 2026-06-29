using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.Interview.Features.Grading.Judge0;

public class Judge0Client(HttpClient httpClient)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // Bound how many Judge0 submissions are in flight per replica. This is a safety
    // cap only — the candidate "run" path has its own Redis-backed backpressure on top;
    // this keeps grading bursts from overwhelming a single Judge0 worker.
    private static readonly SemaphoreSlim Gate = new(16, 16);

    public async Task<Judge0Result> SubmitAsync(
        string sourceCode,
        int languageId,
        string? stdin,
        string? expectedOutput,
        CancellationToken ct,
        Judge0ExecutionLimits? limits = null,
        string? additionalFilesBase64 = null)
    {
        var body = new Dictionary<string, object?>
        {
            ["source_code"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(sourceCode)),
            ["language_id"] = languageId,
            ["stdin"] = stdin is null ? null : Convert.ToBase64String(Encoding.UTF8.GetBytes(stdin)),
            ["expected_output"] = expectedOutput is null ? null : Convert.ToBase64String(Encoding.UTF8.GetBytes(expectedOutput)),
        };

        // Multi-file projects: a base64 zip extracted into the working dir alongside the entry
        // (source_code), so sibling imports resolve. Already base64, so it's sent as-is.
        if (!string.IsNullOrEmpty(additionalFilesBase64))
        {
            body["additional_files"] = additionalFilesBase64;
        }

        // Sandbox limits for the public candidate "run" path: disable network and cap
        // CPU/wall time, memory, and process/thread count so candidate code can't open
        // sockets (SSRF into the cluster), fork-bomb, or run unbounded.
        if (limits is not null)
        {
            body["cpu_time_limit"] = limits.CpuTimeLimitSeconds;
            body["wall_time_limit"] = limits.WallTimeLimitSeconds;
            body["memory_limit"] = limits.MemoryLimitKb;
            body["max_processes_and_or_threads"] = limits.MaxProcessesAndOrThreads;
            body["enable_network"] = limits.EnableNetwork;
        }

        // Serialize to a buffered StringContent so the request carries a
        // Content-Length header. PostAsJsonAsync streams without one (chunked
        // transfer encoding), which Judge0's Rack stack fails to parse — it sees
        // an empty body and rejects the submission with 422.
        var json = JsonSerializer.Serialize(body);

        await Gate.WaitAsync(ct);
        try
        {
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync(
                "/submissions?base64_encoded=true&wait=false", content, ct);
            response.EnsureSuccessStatusCode();

            var submission = await response.Content.ReadFromJsonAsync<Judge0SubmissionResponse>(JsonOptions, ct)
                ?? throw new InvalidOperationException("Empty Judge0 submission response.");

            return await PollAsync(submission.Token, ct);
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task<Judge0Result> PollAsync(string token, CancellationToken ct)
    {
        // Poll every 350ms (Judge0 typically finishes a small program well under a
        // second). ~85 attempts keeps roughly a 30s ceiling for slow/hung runs.
        for (var attempt = 0; attempt < 85; attempt++)
        {
            await Task.Delay(350, ct);

            var response = await httpClient.GetAsync(
                $"/submissions/{token}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory", ct);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<Judge0SubmissionResult>(JsonOptions, ct)
                ?? throw new InvalidOperationException("Empty Judge0 result response.");

            // status.id > 2 means processing is done (1=In Queue, 2=Processing, 3+=done)
            if (result.Status?.Id > 2)
            {
                return new Judge0Result(
                    StatusId: result.Status.Id,
                    StatusDescription: result.Status.Description ?? string.Empty,
                    Stdout: DecodeBase64(result.Stdout),
                    Stderr: DecodeBase64(result.Stderr),
                    CompileOutput: DecodeBase64(result.CompileOutput),
                    Time: result.Time,
                    Memory: result.Memory
                );
            }
        }

        throw new TimeoutException("Judge0 submission timed out after 30 seconds.");
    }

    private static string? DecodeBase64(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
        }
        catch
        {
            return value;
        }
    }

    private sealed class Judge0SubmissionResponse
    {
        [JsonPropertyName("token")]
        public string Token { get; set; } = string.Empty;
    }

    private sealed class Judge0SubmissionResult
    {
        [JsonPropertyName("status")]
        public Judge0Status? Status { get; set; }

        [JsonPropertyName("stdout")]
        public string? Stdout { get; set; }

        [JsonPropertyName("stderr")]
        public string? Stderr { get; set; }

        [JsonPropertyName("compile_output")]
        public string? CompileOutput { get; set; }

        [JsonPropertyName("time")]
        public string? Time { get; set; }

        [JsonPropertyName("memory")]
        public int? Memory { get; set; }
    }

    private sealed class Judge0Status
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }
    }
}

/// <summary>
/// Hard execution limits applied to a Judge0 submission. Used by the public candidate
/// "run" endpoint; auto-grading passes none and inherits the server defaults.
/// </summary>
public sealed record Judge0ExecutionLimits(
    double CpuTimeLimitSeconds,
    double WallTimeLimitSeconds,
    int MemoryLimitKb,
    int MaxProcessesAndOrThreads,
    bool EnableNetwork = false);

public record Judge0Result(
    int StatusId,
    string StatusDescription,
    string? Stdout,
    string? Stderr,
    string? CompileOutput,
    string? Time,
    int? Memory
)
{
    public bool Accepted => StatusId == 3; // 3 = Accepted
}
