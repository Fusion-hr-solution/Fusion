using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public class WorkforceControllerAuthorizationTests
{
    [Fact]
    public void Controller_RequiresAuthenticatedUserAtClassLevel()
    {
        var authorize = typeof(WorkforceController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Null(authorize!.Roles);
    }

    [Theory]
    [InlineData(nameof(WorkforceController.GetCurrentContext))]
    [InlineData(nameof(WorkforceController.GetEmployee))]
    [InlineData(nameof(WorkforceController.GetPublishedOrgUnits))]
    public void PermissionControlledEndpoints_DoNotDeclareMethodRoleAttributes(string methodName)
    {
        var method = typeof(WorkforceController).GetMethod(methodName);
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.True(authorize is null || string.IsNullOrWhiteSpace(authorize.Roles));
    }
}
