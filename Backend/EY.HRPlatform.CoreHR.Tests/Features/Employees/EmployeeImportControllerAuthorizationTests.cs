using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    [Fact]
    public void ValidateEndpoint_UsesExpectedPostRoute()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Validate));

        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<HttpPostAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal("{sessionId:guid}/validate", attribute!.Template);
    }
}