using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Models.Requests;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerAuthorizationTests
{
    private const string LinkedEmployeeReadRoles = PlatformRole.HRAdmin + "," + PlatformRole.Employee + "," + PlatformRole.Manager;

    [Theory]
    [InlineData(nameof(EmployeesController.Create))]
    [InlineData(nameof(EmployeesController.Update))]
    [InlineData(nameof(EmployeesController.Deactivate))]
    public void WriteEndpoints_RequireHrAdmin(string methodName)
    {
        var method = GetControllerMethod(methodName);

        var authorizeAttribute = method.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Equal(PlatformRole.HRAdmin, authorizeAttribute.Roles);
    }

    [Fact]
    public void Controller_RequiresAuthenticatedUserAtClassLevel()
    {
        var authorizeAttribute = typeof(EmployeesController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorizeAttribute);
        Assert.Null(authorizeAttribute.Roles);
    }

    [Fact]
    public void UpdateSelfProfile_AllowsLinkedEmployeeReadRoles()
    {
        var method = typeof(EmployeesController).GetMethod(
            nameof(EmployeesController.UpdateSelfProfile),
            [typeof(Guid), typeof(UpdateOwnEmployeeProfileRequest), typeof(string), typeof(CancellationToken)]);

        var authorizeAttribute = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.NotNull(authorizeAttribute);
        Assert.Equal(LinkedEmployeeReadRoles, authorizeAttribute!.Roles);
    }

    private static MethodInfo GetControllerMethod(string methodName)
        => typeof(EmployeesController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"Could not find EmployeesController.{methodName}.");
}
