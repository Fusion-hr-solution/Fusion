using System.Text.Json.Serialization;

namespace EY.HRPlatform.Identity.Models.Responses;

public class ApiResponse<T>
{
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();
    public bool IsSuccess => Errors.Count == 0;

    /// <summary>
    /// Structured failure detail — typically a stable failure code — so a caller
    /// can branch on something other than the message text. Omitted when absent,
    /// so existing responses are unchanged.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Details { get; set; }

    public static ApiResponse<T> Success(T data) => new() { Data = data };
    public static ApiResponse<T> Failure(params string[] errors) => new() { Errors = errors.ToList() };
    public static ApiResponse<T> Failure(string error, object? details) => new() { Errors = [error], Details = details };
}

public class ApiResponse
{
    public List<string> Errors { get; set; } = new();
    public bool IsSuccess => Errors.Count == 0;

    public static ApiResponse Success() => new();
    public static ApiResponse Failure(params string[] errors) => new() { Errors = errors.ToList() };
}