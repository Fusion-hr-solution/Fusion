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
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>();

        // Assert
        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }
}