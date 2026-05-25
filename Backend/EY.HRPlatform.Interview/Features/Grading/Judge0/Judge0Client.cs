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

    public async Task<Judge0Result> SubmitAsync(
        string sourceCode,
        int languageId,
        string? stdin,
        string? expectedOutput,
        CancellationToken ct)
    {
        var body = new
        {
            source_code = Convert.ToBase64String(Encoding.UTF8.GetBytes(sourceCode)),
            language_id = languageId,
            stdin = stdin is null ? null : Convert.ToBase64String(Encoding.UTF8.GetBytes(stdin)),
            expected_output = expectedOutput is null ? null : Convert.ToBase64String(Encoding.UTF8.GetBytes(expectedOutput)),
        };

        var response = await httpClient.PostAsJsonAsync(
            "/submissions?base64_encoded=true&wait=false", body, ct);
        response.EnsureSuccessStatusCode();

        var submission = await response.Content.ReadFromJsonAsync<Judge0SubmissionResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Empty Judge0 submission response.");

        return await PollAsync(submission.Token, ct);
    }

    private async Task<Judge0Result> PollAsync(string token, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 30; attempt++)
        {
            await Task.Delay(1000, ct);

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
