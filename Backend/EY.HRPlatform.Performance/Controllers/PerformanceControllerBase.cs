using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// Shared controller helpers: maps the domain <see cref="Result{T}"/> onto the standard
/// <see cref="ApiResponse{T}"/> envelope with a status matched to the error kind, so failures
/// never leak stack traces or internal types to the client.
/// </summary>
public abstract class PerformanceControllerBase : ControllerBase
{
    protected ActionResult<ApiResponse<T>> MapResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(ApiResponse<T>.Success(result.Value));

        return StatusFor(result.Error, ApiResponse<T>.Failure(result.Error.Message));
    }

    protected ActionResult<ApiResponse> MapResult(Result result)
    {
        if (result.IsSuccess)
            return Ok(ApiResponse.Success());

        return StatusFor(result.Error, ApiResponse.Failure(result.Error.Message));
    }

    private ActionResult StatusFor(Error error, object body)
    {
        var code = error.Code;
        if (code.EndsWith(".NotFound", StringComparison.Ordinal))
            return NotFound(body);
        if (code.Contains("Forbidden", StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, body);
        if (code.EndsWith(".Conflict", StringComparison.Ordinal)
            || code.EndsWith(".NotDraft", StringComparison.Ordinal)
            || code.EndsWith(".NotActivatable", StringComparison.Ordinal)
            || code.EndsWith(".NotEditable", StringComparison.Ordinal)
            || code.EndsWith(".NotPublishable", StringComparison.Ordinal)
            || code.EndsWith(".Unresolved", StringComparison.Ordinal)
            || code.EndsWith(".Empty", StringComparison.Ordinal)
            || code.EndsWith(".Closed", StringComparison.Ordinal))
            return Conflict(body);

        return BadRequest(body);
    }
}
