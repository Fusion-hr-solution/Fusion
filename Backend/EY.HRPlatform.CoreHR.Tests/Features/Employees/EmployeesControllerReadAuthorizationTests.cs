using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerReadAuthorizationTests
{
    [Theory]
    [InlineData(nameof(EmployeesController.GetReportingLines))]
    public void LinkedEmployeeReadEndpoints_DoNotUseMethodRoleAttributes(string methodName)
    {
        var method = typeof(EmployeesController).GetMethod(methodName, [typeof(Guid), typeof(CancellationToken)]);

        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.True(authorize is null || string.IsNullOrWhiteSpace(authorize.Roles));
    }
}
