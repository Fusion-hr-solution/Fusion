using System.Net.Http.Headers;
using Microsoft.Net.Http.Headers;

namespace EY.HRPlatform.Performance.Infrastructure.Workforce;

/// <summary>
/// Forwards the inbound request's Authorization header to downstream service calls so the
/// callee (Core) enforces the original caller's identity, tenant, and visibility scope.
/// </summary>
public sealed class BearerTokenForwardingHandler(IHttpContextAccessor httpContextAccessor) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var authHeader = httpContextAccessor.HttpContext?.Request.Headers[HeaderNames.Authorization].ToString();
        if (!string.IsNullOrWhiteSpace(authHeader)
            && AuthenticationHeaderValue.TryParse(authHeader, out var parsed))
        {
            request.Headers.Authorization = parsed;
        }

        return await base.SendAsync(request, cancellationToken);
    }
}
