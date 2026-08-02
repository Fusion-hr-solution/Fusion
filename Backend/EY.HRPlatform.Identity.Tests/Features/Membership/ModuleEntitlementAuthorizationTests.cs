using System.Security.Claims;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Identity.Tests.Features.Membership;

/// <summary>
/// The entitlement requirement is the security boundary Core HR and Performance
/// share. It grants only on a customer tenant context plus the matching module,
/// so control-plane authority and cross-tenant claims cannot satisfy it.
/// </summary>
public sealed class ModuleEntitlementAuthorizationTests
{
    private static readonly Guid TenantA = new("aaaaaaaa-0000-0000-0000-00000000000a");

    private static ClaimsPrincipal Principal(params Claim[] claims)
        => new(new ClaimsIdentity(claims, authenticationType: "test"));

    private static async Task<bool> EvaluateAsync(ClaimsPrincipal user, string module)
    {
        var requirement = new ModuleEntitlementRequirement(module);
        var context = new AuthorizationHandlerContext([requirement], user, resource: null);
        await new ModuleEntitlementHandler().HandleAsync(context);
        return context.HasSucceeded;
    }

    [Fact]
    public async Task Member_of_an_entitled_tenant_is_granted()
    {
        var user = Principal(
            new Claim(CustomClaimTypes.TenantId, TenantA.ToString()),
            new Claim(CustomClaimTypes.ModuleEntitlement, ModuleEntitlements.CoreHR));

        Assert.True(await EvaluateAsync(user, ModuleEntitlements.CoreHR));
    }

    [Fact]
    public async Task Disabled_module_is_denied()
    {
        // The tenant exists and the caller belongs to it, but Performance is not
        // enabled for that tenant.
        var user = Principal(
            new Claim(CustomClaimTypes.TenantId, TenantA.ToString()),
            new Claim(CustomClaimTypes.ModuleEntitlement, ModuleEntitlements.CoreHR));

        Assert.False(await EvaluateAsync(user, ModuleEntitlements.Performance));
    }

    [Fact]
    public async Task Entitlement_without_tenant_context_is_denied()
    {
        // A session that failed closed carries no tenant. An entitlement claim
        // alone must never substitute for membership authority.
        var user = Principal(
            new Claim(CustomClaimTypes.ModuleEntitlement, ModuleEntitlements.CoreHR));

        Assert.False(await EvaluateAsync(user, ModuleEntitlements.CoreHR));
    }

    [Fact]
    public async Task Platform_administrator_role_alone_is_denied()
    {
        // Control-plane authority is not customer authority, and a Platform
        // Administrator holds no tenant claim to begin with.
        var user = Principal(
            new Claim(ClaimTypes.Role, PlatformRole.PlatformAdmin));

        Assert.False(await EvaluateAsync(user, ModuleEntitlements.CoreHR));
        Assert.False(await EvaluateAsync(user, ModuleEntitlements.Performance));
    }

    [Fact]
    public async Task Unauthenticated_caller_is_denied()
    {
        Assert.False(await EvaluateAsync(new ClaimsPrincipal(new ClaimsIdentity()), ModuleEntitlements.CoreHR));
    }

    [Fact]
    public void Module_entitlement_reading_requires_a_tenant()
    {
        var withoutTenant = Principal(
            new Claim(CustomClaimTypes.ModuleEntitlement, ModuleEntitlements.CoreHR));
        Assert.False(withoutTenant.HasModuleEntitlement(ModuleEntitlements.CoreHR));

        var withTenant = Principal(
            new Claim(CustomClaimTypes.TenantId, TenantA.ToString()),
            new Claim(CustomClaimTypes.ModuleEntitlement, ModuleEntitlements.CoreHR));
        Assert.True(withTenant.HasModuleEntitlement(ModuleEntitlements.CoreHR));
        Assert.Equal(TenantA, withTenant.GetTenantId());
    }
}
