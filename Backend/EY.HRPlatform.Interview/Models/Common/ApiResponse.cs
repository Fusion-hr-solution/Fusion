using System.Text.Json.Serialization;

namespace EY.HRPlatform.Interview.Models.Common;

public class ApiResponse<T>
{
    [JsonPropertyName("success")]
    public bool Succeeded { get; set; }

    [JsonPropertyName("isSuccess")]
    public bool IsSuccess => Succeeded;

    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = [];

    public static ApiResponse<T> Success(T data, string message = "Request succeeded.")
        => new() { Succeeded = true, Message = message, Data = data };

    public static ApiResponse<T> Failure(string message, params string[] errors)
        => new() { Succeeded = false, Message = message, Errors = [.. errors] };
}

public class ApiResponse
{
    [JsonPropertyName("success")]
    public bool Succeeded { get; set; }

    [JsonPropertyName("isSuccess")]
    public bool IsSuccess => Succeeded;

    public string Message { get; set; } = string.Empty;
    public List<string> Errors { get; set; } = [];

    public static ApiResponse Success(string message = "Request succeeded.")
        => new() { Succeeded = true, Message = message };

    public static ApiResponse Failure(string message, params string[] errors)
        => new() { Succeeded = false, Message = message, Errors = [.. errors] };
}