using System.Net.Http.Json;
using System.Security.Claims;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Security;

namespace EY.HRPlatform.Gateway.Middleware;

/// <summary>
/// Rejects an authenticated customer request whose access token no longer carries
/// tenant authority, before it reaches any downstream service.
/// <para>
/// This is the one non-business concern the Gateway owns. It evaluates account,
/// tenant, membership, and access-revision currency only; permissions, scopes,
/// and module rules stay with Core HR, Performance, and Identity.
/// </para>
/// <para>
/// It exists because "suspension takes effect immediately" cannot otherwise be
/// true: an access token is valid for its whole lifetime, so without a per-request
/// check a suspended administrator keeps working until it expires. There is
/// deliberately no positive cache and no accepted staleness window — either would
/// reintroduce exactly the window this removes.
/// </para>
/// <para>
/// The cost is real and accepted: one intra-host round trip per authenticated
/// customer request, and Identity becomes a hard dependency of customer traffic.
/// When Identity cannot answer, requests are denied rather than served on stale
/// authority.
/// </para>
/// </summary>
public sealed class TenantAuthorityGateMiddleware(
    RequestDelegate next,
    IHttpClientFactory httpClientFactory,
    IInternalServiceRequestSigner signer,
    IConfiguration configuration,
    ILogger<TenantAuthorityGateMiddleware> logger)
{
    /// <summary>
    /// Paths the gate never applies to. Anonymous public journeys carry no tenant
    /// claims, and sign-in and refresh must stay reachable so a rejected person
    /// can obtain a current token instead of being locked out of recovery.
    /// </summary>
    private static readonly string[] ExemptPathPrefixes =
    [
        "/health",
        "/api/identity/auth",
        "/api/identity/tenant-access/invitations/inspect",
        "/api/identity/tenant-access/invitations/accept",
        "/api/identity/tenant-activation",
        "/internal/",
    ];

    public async Task InvokeAsync(HttpContext context)
    {
        if (!ShouldEvaluate(context))
        {
            await next(context);
            return;
        }

        var read = CustomerAuthorityClaims.Read(context.User);

        // No customer context at all — a Platform Administrator, or an account
        // with zero or several active memberships. Nothing to validate here;
        // downstream boundaries already fail closed on absent tenancy.
        if (read.Kind == CustomerClaimsKind.None)
        {
            await next(context);
            return;
        }

        string? reason;

        if (read.Kind == CustomerClaimsKind.Incomplete)
        {
            // The token asserts tenant context but does not carry a usable access
            // revision, so its authority cannot be checked. That is the shape of a
            // token minted before this gate existed: forwarding it would let every
            // token issued before the cutover outlive a suspension until it
            // expired, which is precisely the window this gate removes.
            reason = TenantAuthorityDenialReasons.RevisionStale;
        }
        else
        {
            bool valid;
            (valid, reason) = await EvaluateAsync(read.Claims!, context.RequestAborted);

            if (valid)
            {
                await next(context);
                return;
            }
        }

        logger.LogInformation(
            "Tenant authority rejected for membership {MembershipId}: {Reason}",
            read.Claims?.MembershipId, reason);

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/problem+json";

        // A stable, typed body so the frontend treats this as authority loss —
        // clear protected state and leave the tenant experience — rather than as
        // a generic expired session it would try to refresh.
        await context.Response.WriteAsJsonAsync(new
        {
            type = "authority-revoked",
            title = "Tenant access is no longer authorized.",
            status = StatusCodes.Status401Unauthorized,
            reason,
        });
    }

    private static bool ShouldEvaluate(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        return !ExemptPathPrefixes.Any(prefix =>
            path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<(bool Valid, string? Reason)> EvaluateAsync(
        TenantAuthorityStateRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var baseUrl = configuration["ServiceUrls:IdentityApiBaseUrl"] ?? "http://localhost:5101";
            var client = httpClientFactory.CreateClient("identity-authority");

            using var message = new HttpRequestMessage(
                HttpMethod.Post,
                new Uri(new Uri(baseUrl.TrimEnd('/') + "/"), "internal/identity/access/authority-state"))
            {
                Content = JsonContent.Create(request),
            };

            await signer.SignAsync(message, cancellationToken);

            using var response = await client.SendAsync(message, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                return (false, TenantAuthorityDenialReasons.AuthorityUnavailable);
            }

            var state = await response.Content.ReadFromJsonAsync<TenantAuthorityStateResponse>(cancellationToken);

            return state is null
                ? (false, TenantAuthorityDenialReasons.AuthorityUnavailable)
                : (state.Valid, state.Reason);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Fails closed. Serving the request on an unverified token would mean
            // that an Identity outage silently restores access to everyone whose
            // access was withdrawn.
            logger.LogError(exception, "Tenant authority check failed; denying the request.");
            return (false, TenantAuthorityDenialReasons.AuthorityUnavailable);
        }
    }
}
