using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Requires a customer tenant context derived from an Active membership, plus the
/// named module enabled for that tenant.
/// </summary>
public sealed class ModuleEntitlementRequirement(string module) : IAuthorizationRequirement
{
    public string Module { get; } = module;
}

/// <summary>
/// Grants only when the trusted session carries both a customer tenant and the
/// matching entitlement. A Platform Administrator has no tenant claim, so this
/// denies without needing to inspect roles at all: control-plane authority simply
/// never satisfies a customer-module requirement.
/// </summary>
public sealed class ModuleEntitlementHandler : AuthorizationHandler<ModuleEntitlementRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ModuleEntitlementRequirement requirement)
    {
        if (context.User.HasModuleEntitlement(requirement.Module))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

public static class ModuleEntitlementAuthorizationExtensions
{
    /// <summary>
    /// Registers the entitlement handler and the Core HR and Performance policies.
    /// </summary>
    public static IServiceCollection AddModuleEntitlementAuthorization(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, ModuleEntitlementHandler>();

        services.AddAuthorizationBuilder()
            .AddPolicy(ModuleEntitlementPolicies.CoreHR, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.Requirements.Add(new ModuleEntitlementRequirement(ModuleEntitlements.CoreHR));
            })
            .AddPolicy(ModuleEntitlementPolicies.Performance, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.Requirements.Add(new ModuleEntitlementRequirement(ModuleEntitlements.Performance));
            });

        return services;
    }
}
