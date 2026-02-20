namespace EY.HRPlatform.Identity.Models.Responses;

public class ApiResponse<T>
{
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();
    public bool IsSuccess => Errors.Count == 0;

    public static ApiResponse<T> Success(T data) => new() { Data = data };
    public static ApiResponse<T> Failure(params string[] errors) => new() { Errors = errors.ToList() };
}

public class ApiResponse
{
    public List<string> Errors { get; set; } = new();
    public bool IsSuccess => Errors.Count == 0;

    public static ApiResponse Success() => new();
    public static ApiResponse Failure(params string[] errors) => new() { Errors = errors.ToList() };
}