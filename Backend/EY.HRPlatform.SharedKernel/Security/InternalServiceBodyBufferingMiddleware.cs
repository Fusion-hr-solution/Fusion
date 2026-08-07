using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.SharedKernel.Security;

/// <summary>
/// Makes the request body re-readable for internal service-to-service routes.
/// <para>
/// The signature these routes carry is body-bound, so the authorizer has to hash
/// exactly what the caller sent. By the time a controller action runs, MVC has
/// already read the body to bind the model — and a request stream is
/// forward-only, so enabling buffering at that point wraps a stream that has
/// nothing left in it. The authorizer then hashes an empty body, the signature
/// never matches, and every signed call is rejected.
/// </para>
/// <para>
/// Buffering therefore has to be turned on before model binding, which means
/// middleware rather than anything the action itself can do.
/// </para>
/// </summary>
public static class InternalServiceBodyBuffering
{
    private const string InternalPathPrefix = "/internal/";

    /// <summary>
    /// Register before <c>UseRouting</c> so buffering is enabled ahead of model
    /// binding. Scoped to internal routes: ordinary customer traffic has no
    /// body-bound signature and should not pay to buffer its payloads.
    /// </summary>
    public static IApplicationBuilder UseInternalServiceBodyBuffering(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments(InternalPathPrefix.TrimEnd('/'),
                    StringComparison.OrdinalIgnoreCase))
            {
                context.Request.EnableBuffering();
            }

            await next(context);
        });
    }
}
