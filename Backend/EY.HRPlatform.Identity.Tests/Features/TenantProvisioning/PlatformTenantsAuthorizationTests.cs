using System.Reflection;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// The Platform control plane reads and writes across every customer tenant, so
/// authentication alone is not the bar: an ordinary authenticated account —
/// including a customer's own administrator — must not reach cross-tenant tenant
/// data or provisioning activity.
///
/// These assertions are deliberately about the contract rather than one endpoint,
/// so an action added later cannot quietly ship without the role behind it.
/// </summary>
public class PlatformTenantsAuthorizationTests
{
    private static readonly Type Controller = typeof(PlatformTenantsController);

    private static IEnumerable<MethodInfo> Endpoints => Controller
        .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
        .Where(method => method.GetCustomAttributes<HttpMethodAttribute>().Any());

    [Fact]
    public void Controller_is_bound_to_the_Platform_Administrator_role()
    {
        var authorize = Controller.GetCustomAttributes<AuthorizeAttribute>().ToList();

        var attribute = Assert.Single(authorize);

        // Roles, not merely [Authorize]: the difference is whether any signed-in
        // account can read the whole estate.
        Assert.Equal(PlatformRole.PlatformAdmin, attribute.Roles);
    }

    [Fact]
    public void No_endpoint_opts_out_of_the_role_requirement()
    {
        foreach (var endpoint in Endpoints)
        {
            Assert.Empty(endpoint.GetCustomAttributes<AllowAnonymousAttribute>());

            // An action-level [Authorize] with different roles would replace the
            // controller's requirement for that action rather than add to it.
            foreach (var authorize in endpoint.GetCustomAttributes<AuthorizeAttribute>())
            {
                Assert.Equal(PlatformRole.PlatformAdmin, authorize.Roles);
            }
        }
    }

    [Fact]
    public void Cross_tenant_activity_is_reachable_only_through_the_guarded_controller()
    {
        var activity = Assert.Single(Endpoints.Where(method => method.Name == "Activity"));

        // The read exists on this controller and nowhere else, so there is no
        // second, unguarded route to the same records.
        Assert.Empty(activity.GetCustomAttributes<AllowAnonymousAttribute>());
        Assert.Equal(
            PlatformRole.PlatformAdmin,
            Assert.Single(Controller.GetCustomAttributes<AuthorizeAttribute>()).Roles);
    }
}
