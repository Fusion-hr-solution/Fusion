using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class OrgUnitsControllerAuthorizationTests
{
    [Fact]
    public void Controller_RequiresAuthenticatedUserAtClassLevel()
    {
        var authorizeAttribute = typeof(OrgUnitsController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Null(authorizeAttribute!.Roles);
    }

    [Theory]
    [InlineData("Create")]
    [InlineData("Update")]
    public void OrgUnitMutations_RequireHRAdminRole(string methodName)
    {
        // Responsible-manager changes flow through Create/Update; both must be deny-by-default,
        // restricted to the HR admin role server-side.
        var method = typeof(OrgUnitsController).GetMethod(methodName);
        Assert.NotNull(method);

        var authorize = method!.GetCustomAttribute<AuthorizeAttribute>(inherit: false);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }
}
