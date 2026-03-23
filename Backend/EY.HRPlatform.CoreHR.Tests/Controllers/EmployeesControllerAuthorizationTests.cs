using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Controllers;

public class EmployeesControllerAuthorizationTests
{
    [Fact]
    public void Controller_HasAuthorizeAttribute_WithAdminAndHRRoles()
    {
        // Arrange
        var controllerType = typeof(EmployeesController);

        // Act
        var authorizeAttribute = controllerType.GetCustomAttribute<AuthorizeAttribute>();

        // Assert
        Assert.NotNull(authorizeAttribute);
        Assert.NotNull(authorizeAttribute.Roles);

        var roles = authorizeAttribute.Roles.Split(',').Select(r => r.Trim()).ToArray();
        Assert.Contains(PlatformRole.Admin, roles);
        Assert.Contains(PlatformRole.HR, roles);
    }

    [Fact]
    public void Controller_DoesNotAllowEmployeeRole()
    {
        // Arrange
        var controllerType = typeof(EmployeesController);

        // Act
        var authorizeAttribute = controllerType.GetCustomAttribute<AuthorizeAttribute>();

        // Assert
        Assert.NotNull(authorizeAttribute);
        Assert.NotNull(authorizeAttribute.Roles);

        var roles = authorizeAttribute.Roles.Split(',').Select(r => r.Trim()).ToArray();
        Assert.DoesNotContain(PlatformRole.Employee, roles);
    }

    [Fact]
    public void Controller_DoesNotAllowManagerRole()
    {
        // Arrange
        var controllerType = typeof(EmployeesController);

        // Act
        var authorizeAttribute = controllerType.GetCustomAttribute<AuthorizeAttribute>();

        // Assert
        Assert.NotNull(authorizeAttribute);
        Assert.NotNull(authorizeAttribute.Roles);

        var roles = authorizeAttribute.Roles.Split(',').Select(r => r.Trim()).ToArray();
        Assert.DoesNotContain(PlatformRole.Manager, roles);
    }

    [Theory]
    [InlineData(nameof(EmployeesController.Create))]
    [InlineData(nameof(EmployeesController.GetById))]
    [InlineData(nameof(EmployeesController.Update))]
    [InlineData(nameof(EmployeesController.Deactivate))]
    public void AllEndpoints_InheritControllerLevelAuthorization(string methodName)
    {
        // Arrange
        var controllerType = typeof(EmployeesController);
        var method = controllerType.GetMethod(methodName);

        // Act
        var methodAllowAnonymous = method?.GetCustomAttribute<AllowAnonymousAttribute>();
        var methodAuthorize = method?.GetCustomAttribute<AuthorizeAttribute>();

        // Assert - no method should override with AllowAnonymous or its own Authorize
        Assert.Null(methodAllowAnonymous);
        Assert.Null(methodAuthorize);
    }
}
