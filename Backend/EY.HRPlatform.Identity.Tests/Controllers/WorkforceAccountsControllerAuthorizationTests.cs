using System.Reflection;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Identity.Tests.Controllers;

public class WorkforceAccountsControllerAuthorizationTests
{
    [Fact]
    public void Controller_RequiresHrAdminRole()
    {
        var authorize = typeof(WorkforceAccountsController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }
}
