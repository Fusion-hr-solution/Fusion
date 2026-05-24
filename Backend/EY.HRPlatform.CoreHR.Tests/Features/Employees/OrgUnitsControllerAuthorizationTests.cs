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
}
