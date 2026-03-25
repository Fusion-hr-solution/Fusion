namespace EY.HRPlatform.Interview.Models.Common;

public class ApiException : Exception
{
    public int StatusCode { get; }
    public List<string> Errors { get; }

    public ApiException(string message, int statusCode = StatusCodes.Status400BadRequest, IEnumerable<string>? errors = null)
        : base(message)
    {
        StatusCode = statusCode;
        Errors = errors?.ToList() ?? [];
    }
}
