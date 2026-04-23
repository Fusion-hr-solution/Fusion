using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeImportControllerAuthorizationTests
{
    [Fact]
    public void Controller_RequiresHrAdminRoleAtClassLevel()
    {
        var attribute = typeof(EmployeeImportController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal(PlatformRole.HRAdmin, attribute!.Roles);
    }
}