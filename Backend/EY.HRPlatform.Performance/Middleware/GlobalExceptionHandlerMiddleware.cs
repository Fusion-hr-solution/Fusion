using System.Text.Json;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Models.Responses;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Middleware;

/// <summary>
/// Translates unhandled exceptions into the same RFC 7807 problem shape the controllers emit, so a
/// client sees one failure format regardless of where the failure came from (design D7).
/// </summary>
/// <remarks>
/// Catch order is deliberate (design D8). <see cref="ArgumentNullException"/> and
/// <see cref="ArgumentOutOfRangeException"/> are caught <em>before</em> <see cref="ArgumentException"/>
/// and reported as internal faults, because they are: previously they surfaced as a 400 echoing an
/// internal parameter name to the caller.
/// </remarks>
public class GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (EntityNotFoundException ex)
        {
            logger.LogWarning(ex, "Entity not found: {EntityType} for {Method} {Path}",
                ex.EntityType, context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status404NotFound, "Performance.NotFound", ex.Message);
        }
        catch (DuplicateEntityException ex)
        {
            logger.LogWarning(ex, "Duplicate entity: {EntityType} for {Method} {Path}",
                ex.EntityType, context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status409Conflict, "Performance.Duplicate", ex.Message);
        }
        catch (ConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrency conflict: {EntityType} {EntityId} for {Method} {Path}",
                ex.EntityType, ex.EntityId, context.Request.Method, context.Request.Path);

            // The client must reload and reapply rather than silently retry with a stale version.
            await WriteAsync(context, StatusCodes.Status409Conflict, "Performance.VersionConflict", ex.Message);
        }
        catch (DomainRuleViolationException ex)
        {
            logger.LogWarning(ex, "Domain rule violation for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status409Conflict, "Performance.RuleViolation", ex.Message);
        }
        catch (TenantAccessDeniedException ex)
        {
            logger.LogWarning(ex, "Tenant access denied for {Method} {Path}", context.Request.Method, context.Request.Path);

            // Discloses nothing about whether the target exists.
            await WriteAsync(context, StatusCodes.Status403Forbidden, "Performance.Forbidden",
                "You do not have access to this.");
        }
        catch (CoreWorkforceUnavailableException ex)
        {
            // Recoverable: the caller did nothing wrong and the same request may succeed later.
            // Reached only outside the MediatR pipeline, which returns this as a result instead.
            logger.LogWarning(ex, "Core HR unavailable for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status503ServiceUnavailable,
                PerformanceDependencyErrors.CoreWorkforceUnavailableCode, ex.Message);
        }
        catch (DomainValidationException ex)
        {
            logger.LogWarning(ex, "Validation failed for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status422UnprocessableEntity, ex.Code, ex.Message,
                ex.Field is null ? null : new Dictionary<string, string[]> { [ex.Field] = [ex.Message] });
        }
        catch (Exception ex) when (ex is ArgumentNullException or ArgumentOutOfRangeException)
        {
            // An internal defect, not a client error. The specific message names an internal
            // parameter, so it is logged and never returned.
            logger.LogError(ex, "Internal argument fault for {Method} {Path}",
                context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status500InternalServerError, "Performance.Unexpected",
                "An unexpected error occurred.");
        }
        catch (ArgumentException ex)
        {
            logger.LogWarning(ex, "Invalid argument for {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status400BadRequest, "Performance.Invalid", ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for {Method} {Path} (correlation {CorrelationId})",
                context.Request.Method, context.Request.Path, PerformanceProblem.ResolveCorrelationId(context));
            await WriteAsync(context, StatusCodes.Status500InternalServerError, "Performance.Unexpected",
                "An unexpected error occurred.");
        }
    }

    private static async Task WriteAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message,
        object? details = null)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = statusCode >= 500 ? "Unexpected error" : "Request failed",
            Detail = message,
            Type = $"https://fusion.ey/problems/{code}",
            Instance = context.Request.Path
        };

        problem.Extensions[PerformanceProblem.CodeExtension] = code;
        problem.Extensions[PerformanceProblem.CorrelationIdExtension] =
            PerformanceProblem.ResolveCorrelationId(context);

        if (details is not null)
        {
            problem.Extensions[PerformanceProblem.ErrorsExtension] = details;
        }

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
    }
}
