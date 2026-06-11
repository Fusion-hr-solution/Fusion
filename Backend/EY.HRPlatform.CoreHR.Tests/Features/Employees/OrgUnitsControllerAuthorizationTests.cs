using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class OrgUnitsControllerAuthorizationTests
{
    [Fact]
    public void Controller_AllowsPlatformAdminAndHrAdminAtClassLevel()
    {
        var authorizeAttribute = typeof(OrgUnitsController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Equal(PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin, authorizeAttribute!.Roles);
    }
}
