using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[TypeFilter(typeof(PerformanceExceptionFilter))]
public abstract class PerformanceControllerBase : ControllerBase
{
    protected ActionResult<ApiResponse<T>> MapResult<T>(Result<T> result)
        => result.IsSuccess ? Ok(ApiResponse<T>.Success(result.Value))
            : StatusCode(StatusFor(result.Error), ApiResponse<T>.Failure(result.Error.Message, PerformanceErrors.Details(result.Error)));
    protected ActionResult<ApiResponse> MapResult(Result result)
        => result.IsSuccess ? Ok(ApiResponse.Success())
            : StatusCode(StatusFor(result.Error), ApiResponse.Failure(result.Error.Message, PerformanceErrors.Details(result.Error)));

    protected ObjectResult CapabilityForbidden()
    {
        var error = PerformanceErrors.Forbidden("Performance.CapabilityForbidden", "You do not have permission to do this.");
        return StatusCode(StatusCodes.Status403Forbidden,
            ApiResponse.Failure(error.Message, PerformanceErrors.Details(error)));
    }

    public static int StatusFor(Error error) => PerformanceErrors.Details(error).Kind switch
    {
        FailureKind.NotFound => StatusCodes.Status404NotFound,
        FailureKind.Forbidden => StatusCodes.Status403Forbidden,
        FailureKind.Validation => StatusCodes.Status400BadRequest,
        FailureKind.InvalidState or FailureKind.Stale => StatusCodes.Status409Conflict,
        FailureKind.UpstreamUnavailable => StatusCodes.Status503ServiceUnavailable,
        _ => throw new ArgumentOutOfRangeException(nameof(error)),
    };
}
