using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Models.Responses;

/// <summary>
/// Turns an internal <see cref="Error"/> into an RFC 7807 problem response that carries the error
/// code to the client (design D7).
/// </summary>
/// <remarks>
/// <para>
/// Only failures change shape. Success responses stay <c>ApiResponse&lt;T&gt;</c>, and
/// <c>SharedKernel.ApiResponse</c> is untouched — Identity, CoreHR, and Training consume it, and a
/// module owned by this internship must not reshape a contract three other services depend on to
/// solve its own error-taxonomy problem.
/// </para>
/// <para>
/// The point is that clients stop matching on message text. Every problem carries a stable
/// <c>code</c> and a <c>correlationId</c>, and validation failures carry per-field detail.
/// </para>
/// </remarks>
public static class PerformanceProblem
{
    public const string CodeExtension = "code";
    public const string CorrelationIdExtension = "correlationId";
    public const string ErrorsExtension = "errors";

    /// <summary>Builds the problem response for an internal error, choosing status from its code.</summary>
    public static ObjectResult From(HttpContext? httpContext, Error error)
        => Build(httpContext, ResolveStatus(error.Code), error.Code, error.Message, error.Details);

    /// <summary>Builds a problem response for a failure that has no <see cref="Error"/> behind it.</summary>
    public static ObjectResult Create(
        HttpContext? httpContext,
        int statusCode,
        string code,
        string message,
        object? details = null)
        => Build(httpContext, statusCode, code, message, details);

    /// <remarks>
    /// <paramref name="httpContext"/> is nullable so the status and code stay correct when a
    /// controller is exercised directly in a unit test, where no request is in flight. Only the
    /// request path and correlation id depend on it.
    /// </remarks>
    private static ObjectResult Build(
        HttpContext? httpContext,
        int statusCode,
        string code,
        string message,
        object? details)
    {
        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = TitleFor(statusCode),
            Detail = message,
            Type = $"https://fusion.ey/problems/{code}",
            Instance = httpContext?.Request.Path.Value
        };

        problem.Extensions[CodeExtension] = code;
        problem.Extensions[CorrelationIdExtension] = ResolveCorrelationId(httpContext);

        if (details is not null)
        {
            problem.Extensions[ErrorsExtension] = details;
        }

        return new ObjectResult(problem)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }

    /// <summary>
    /// Maps an error code to a status by intent. Codes the module owns are matched exactly; the
    /// remaining conventional suffixes keep the existing behaviour of the per-controller mappers
    /// this replaces.
    /// </summary>
    public static int ResolveStatus(string code) => code switch
    {
        PerformanceDependencyErrors.CoreWorkforceUnavailableCode => StatusCodes.Status503ServiceUnavailable,
        CampaignClosureErrors.CampaignClosedCode => StatusCodes.Status409Conflict,
        _ => ResolveByConvention(code)
    };

    private static int ResolveByConvention(string code)
    {
        if (Contains(code, "NotFound") || Contains(code, "NotConfigured"))
        {
            return StatusCodes.Status404NotFound;
        }

        if (Contains(code, "Forbidden") || Contains(code, "Denied") || Contains(code, "Unauthorized"))
        {
            return StatusCodes.Status403Forbidden;
        }

        if (Contains(code, "Concurrency") || Contains(code, "Stale") || Contains(code, "Conflict"))
        {
            return StatusCodes.Status409Conflict;
        }

        if (Contains(code, "Validation"))
        {
            return StatusCodes.Status422UnprocessableEntity;
        }

        if (Contains(code, "Invalid") || Contains(code, "Required") || Contains(code, "Missing"))
        {
            return StatusCodes.Status400BadRequest;
        }

        // Anything else is a rule the caller violated rather than a malformed request.
        return StatusCodes.Status409Conflict;
    }

    private static bool Contains(string code, string token)
        => code.Contains(token, StringComparison.OrdinalIgnoreCase);

    private static string TitleFor(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => "Invalid request",
        StatusCodes.Status403Forbidden => "Not permitted",
        StatusCodes.Status404NotFound => "Not found",
        StatusCodes.Status409Conflict => "Conflict",
        StatusCodes.Status422UnprocessableEntity => "Validation failed",
        StatusCodes.Status428PreconditionRequired => "Precondition required",
        StatusCodes.Status429TooManyRequests => "Too many requests",
        StatusCodes.Status503ServiceUnavailable => "Temporarily unavailable",
        _ => "Unexpected error"
    };

    public static string ResolveCorrelationId(HttpContext? httpContext)
        => httpContext?.Request.Headers["X-Correlation-Id"].FirstOrDefault()
           ?? httpContext?.TraceIdentifier
           ?? "unavailable";
}
