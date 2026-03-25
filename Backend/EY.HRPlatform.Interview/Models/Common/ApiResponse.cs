namespace EY.HRPlatform.Interview.Models.Common;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = [];

    public static ApiResponse<T> Ok(T data, string message = "Success") => new()
    {
        Success = true,
        Message = message,
        Data = data,
        Errors = []
    };

    public static ApiResponse<T> Fail(string message, IEnumerable<string>? errors = null) => new()
    {
        Success = false,
        Message = message,
        Data = default,
        Errors = errors?.ToList() ?? []
    };
}

public class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Data { get; set; }
    public List<string> Errors { get; set; } = [];

    public static ApiResponse Ok(object? data = null, string message = "Success") => new()
    {
        Success = true,
        Message = message,
        Data = data,
        Errors = []
    };

    public static ApiResponse Fail(string message, IEnumerable<string>? errors = null) => new()
    {
        Success = false,
        Message = message,
        Data = null,
        Errors = errors?.ToList() ?? []
    };
}
