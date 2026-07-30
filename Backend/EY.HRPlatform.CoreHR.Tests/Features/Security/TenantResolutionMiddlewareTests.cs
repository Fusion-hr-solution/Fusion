using System.Security.Claims;
using EY.HRPlatform.CoreHR.Middleware;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.Security;

public class TenantResolutionMiddlewareTests
{
    [Fact]
    public async Task PlatformAdminHeaderWithoutTenantClaim_DoesNotEstablishCustomerContext()
    {
        var headerTenantId = Guid.NewGuid();
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateProtectedContext(
            new Claim(ClaimTypes.Role, PlatformRole.PlatformAdmin));
        context.Request.Headers["X-Tenant-Id"] = headerTenantId.ToString();
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext);

        Assert.False(nextCalled);
        Assert.False(tenantContext.IsResolved);
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
    }

    [Fact]
    public async Task PlatformAdminHeaderCannotOverrideTrustedTenantClaim()
    {
        var trustedTenantId = Guid.NewGuid();
        var headerTenantId = Guid.NewGuid();
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateProtectedContext(
            new Claim(ClaimTypes.Role, PlatformRole.PlatformAdmin),
            new Claim(CustomClaimTypes.TenantId, trustedTenantId.ToString()));
        context.Request.Headers["X-Tenant-Id"] = headerTenantId.ToString();
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext);

        Assert.True(nextCalled);
        Assert.Equal(trustedTenantId, tenantContext.TenantId);
        Assert.NotEqual(headerTenantId, tenantContext.TenantId);
    }

    [Fact]
    public async Task TenantMemberClaim_ResolvesNormallyAndIgnoresHeader()
    {
        var trustedTenantId = Guid.NewGuid();
        var nextCalled = false;
        var middleware = CreateMiddleware(() => nextCalled = true);
        var context = CreateProtectedContext(
            new Claim(CustomClaimTypes.TenantId, trustedTenantId.ToString()));
        context.Request.Headers["X-Tenant-Id"] = "not-a-tenant";
        var tenantContext = new TenantContext();

        await middleware.InvokeAsync(context, tenantContext);

        Assert.True(nextCalled);
        Assert.Equal(trustedTenantId, tenantContext.TenantId);
    }

    private static TenantResolutionMiddleware CreateMiddleware(Action onNext)
        => new(
            _ =>
            {
                onNext();
                return Task.CompletedTask;
            },
            NullLogger<TenantResolutionMiddleware>.Instance);

    private static DefaultHttpContext CreateProtectedContext(params Claim[] claims)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")),
        };
        context.Response.Body = new MemoryStream();
        context.SetEndpoint(new Endpoint(
            _ => Task.CompletedTask,
            new EndpointMetadataCollection(new AuthorizeAttribute()),
            "protected"));
        return context;
    }
}
