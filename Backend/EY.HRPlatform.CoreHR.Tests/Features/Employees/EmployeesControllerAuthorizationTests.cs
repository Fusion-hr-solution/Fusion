using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerAuthorizationTests
{
    [Theory]
    [InlineData(nameof(EmployeesController.Create))]
    [InlineData(nameof(EmployeesController.Update))]
    [InlineData(nameof(EmployeesController.Deactivate))]
    public void WriteEndpoints_RequirePlatformAdminOrHrAdmin(string methodName)
    {
        var method = GetControllerMethod(methodName);

        var authorizeAttribute = method.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Equal($"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}", authorizeAttribute.Roles);
    }

    [Theory]
    [InlineData(nameof(EmployeesController.GetAll))]
    [InlineData(nameof(EmployeesController.GetById))]
    public void ReadEndpoints_DoNotDeclareWriteRoleRestriction(string methodName)
    {
        var method = GetControllerMethod(methodName);

        var authorizeAttribute = method.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.Null(authorizeAttribute);
    }

    [Fact]
    public void Controller_RequiresAuthenticatedUserAtClassLevel()
    {
        var authorizeAttribute = typeof(EmployeesController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Null(authorizeAttribute.Roles);
    }

    private static MethodInfo GetControllerMethod(string methodName)
        => typeof(EmployeesController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"Could not find EmployeesController.{methodName}.");
}