using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerReadAuthorizationTests
{
    private const string HrAdminPlatformReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin;
    private const string LinkedEmployeeReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin + "," + PlatformRole.Employee + "," + PlatformRole.Manager;

    [Fact]
    public void GetAll_AllowsPlatformAdminAndHrAdminRoles()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetAll));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(HrAdminPlatformReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetById_AllowsPlatformAdminAndHrAdminRoles()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetById));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(HrAdminPlatformReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetReportingLines_AllowsPlatformAdminAndHrAdminRoles()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetReportingLines));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(HrAdminPlatformReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetOrgChart_AllowsPlatformAdminAndHrAdminRoles()
    {
        // Arrange
        var method = typeof(EmployeesController).GetMethod(nameof(EmployeesController.GetOrgChart));

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(HrAdminPlatformReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetProfile_AllowsPlatformAdminAndHrAdminRoles()
    {
        // Arrange
        // Specify parameter types to uniquely identify the method (Guid id, CancellationToken cancellationToken)
        var method = typeof(EmployeesController).GetMethod("GetProfile", new[] { typeof(Guid), typeof(CancellationToken) });

        // Act
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(HrAdminPlatformReadRoles, authorize!.Roles);
    }
}
