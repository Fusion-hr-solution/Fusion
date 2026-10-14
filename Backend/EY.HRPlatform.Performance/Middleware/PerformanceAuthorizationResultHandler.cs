using System.Text.Json;
using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace EY.HRPlatform.Performance.Middleware;

public sealed class PerformanceAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _default = new();
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public async Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (!authorizeResult.Forbidden)
        {
            await _default.HandleAsync(next, context, policy, authorizeResult);
            return;
        }

        var error = PerformanceErrors.Forbidden("Performance.EntitlementForbidden", "Performance access is unavailable.");
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(ApiResponse.Failure(error.Message, PerformanceErrors.Details(error)),
            JsonOptions);
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
