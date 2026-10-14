using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Performance.Controllers;

public sealed class PerformanceExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var exception = context.Exception;
        var upstream = exception is HttpRequestException
            || (exception is TaskCanceledException && !context.HttpContext.RequestAborted.IsCancellationRequested)
            || exception.GetType().FullName == "Polly.Timeout.TimeoutRejectedException";
        var error = exception is DbUpdateConcurrencyException ? PerformanceErrors.Changed()
            : upstream ? PerformanceErrors.CoreUnavailable()
            : exception is DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }
                ? PerformanceErrors.UniqueConflict() : null;
        if (error is null) return;
        context.Result = new ObjectResult(ApiResponse.Failure(error.Message, PerformanceErrors.Details(error)))
        {
            StatusCode = PerformanceControllerBase.StatusFor(error),
        };
        context.ExceptionHandled = true;
    }
}
