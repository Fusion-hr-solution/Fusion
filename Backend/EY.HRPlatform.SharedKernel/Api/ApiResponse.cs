using System.Text.Json.Serialization;

namespace EY.HRPlatform.SharedKernel.Api;

/// <summary>
/// Standard API response envelope with data payload.
/// </summary>
public class ApiResponse<T>
{
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = [];
    public bool IsSuccess => Errors.Count == 0;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Details { get; set; }

    public static ApiResponse<T> Success(T data) => new() { Data = data };
    public static ApiResponse<T> Failure(params string[] errors) => new() { Errors = [.. errors] };
    public static ApiResponse<T> Failure(string error, object? details) => new() { Errors = [error], Details = details };
}

/// <summary>
/// Standard API response envelope without data payload.
/// </summary>
public class ApiResponse
{
    public List<string> Errors { get; set; } = [];
    public bool IsSuccess => Errors.Count == 0;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Details { get; set; }

    public static ApiResponse Success() => new();
    public static ApiResponse Failure(params string[] errors) => new() { Errors = [.. errors] };
    public static ApiResponse Failure(string error, object? details) => new() { Errors = [error], Details = details };
}
