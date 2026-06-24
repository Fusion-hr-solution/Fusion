using System.Reflection;
using EY.HRPlatform.Identity.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Identity.Tests.Controllers;

public class WorkforceAccountsControllerAuthorizationTests
{
    [Fact]
    public void Controller_HasAuthorizeAttribute()
    {
        var authorize = typeof(WorkforceAccountsController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Null(authorize!.Roles);
    }

    [Theory]
    [InlineData(nameof(WorkforceAccountsController.GetSummary))]
    [InlineData(nameof(WorkforceAccountsController.GetStatuses))]
    [InlineData(nameof(WorkforceAccountsController.BulkProvision))]
    [InlineData(nameof(WorkforceAccountsController.ProvisionInvite))]
    [InlineData(nameof(WorkforceAccountsController.ResendInvite))]
    [InlineData(nameof(WorkforceAccountsController.Reactivate))]
    [InlineData(nameof(WorkforceAccountsController.Deactivate))]
    public void PermissionControlledEndpoints_DoNotDeclareMethodRoleAttributes(string methodName)
    {
        var method = typeof(WorkforceAccountsController).GetMethod(methodName)
            ?? throw new InvalidOperationException($"Could not find WorkforceAccountsController.{methodName}.");

        var authorize = method.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.True(authorize is null || string.IsNullOrWhiteSpace(authorize.Roles));
    }
}
