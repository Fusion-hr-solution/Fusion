using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerReadAuthorizationTests
{
    [Fact]
    public void GetAll_RequiresHrAdminRole()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetAll));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetById_RequiresHrAdminRole()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetById));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetReportingLines_RequiresHrAdminRole()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetReportingLines));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetOrgChart_RequiresHrAdminRole()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetOrgChart));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetProfile_RequiresHrAdminRole()
    {
        // Arrange
        // Specify parameter types to uniquely identify the method (Guid id, CancellationToken cancellationToken)
        var method = typeof(EmployeesController).GetMethod("GetProfile", new[] { typeof(Guid), typeof(CancellationToken) });

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }
}