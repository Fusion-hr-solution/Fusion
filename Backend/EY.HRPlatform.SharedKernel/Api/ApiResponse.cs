namespace EY.HRPlatform.SharedKernel.Api;

/// <summary>
/// Standard API response wrapper with typed data.
/// Used across all modules for consistent API responses.
/// </summary>
public class ApiResponse<T>
{
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = [];
    public bool IsSuccess => Errors.Count == 0;

    public static ApiResponse<T> Success(T data) => new() { Data = data };
    public static ApiResponse<T> Failure(params string[] errors) => new() { Errors = [.. errors] };
}

/// <summary>
/// Standard API response wrapper without data (for void operations).
/// </summary>
public class ApiResponse
{
    public List<string> Errors { get; set; } = [];
    public bool IsSuccess => Errors.Count == 0;

    public static ApiResponse Success() => new();
    public static ApiResponse Failure(params string[] errors) => new() { Errors = [.. errors] };
}
