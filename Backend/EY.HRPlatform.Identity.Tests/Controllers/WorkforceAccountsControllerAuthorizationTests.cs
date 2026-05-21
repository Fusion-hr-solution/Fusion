using System.Reflection;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.Identity.Tests.Controllers;

public class WorkforceAccountsControllerAuthorizationTests
{
    private const string HrAdminOnly = PlatformRole.HRAdmin;
    private const string PlatformAdminAndHrAdmin = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin;

    [Fact]
    public void Controller_HasAuthorizeAttribute()
    {
        var authorize = typeof(WorkforceAccountsController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Null(authorize!.Roles); // class-level is [Authorize] without roles
    }

    [Fact]
    public void GetStatuses_AllowsPlatformAdminAndHrAdmin()
    {
        var method = GetMethod("GetStatuses");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
    }

    [Fact]
    public void BulkProvision_RequiresHrAdminRole()
    {
        var method = GetMethod("BulkProvision");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(HrAdminOnly, authorize!.Roles);
    }

    [Fact]
    public void ProvisionInvite_RequiresHrAdminRole()
    {
        var method = GetMethod("ProvisionInvite");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(HrAdminOnly, authorize!.Roles);
    }

    [Fact]
    public void ResendInvite_RequiresHrAdminRole()
    {
        var method = GetMethod("ResendInvite");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(HrAdminOnly, authorize!.Roles);
    }

    [Fact]
    public void Reactivate_RequiresHrAdminRole()
    {
        var method = GetMethod("Reactivate");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(HrAdminOnly, authorize!.Roles);
    }

    [Fact]
    public void Deactivate_RequiresHrAdminRole()
    {
        var method = GetMethod("Deactivate");
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(HrAdminOnly, authorize!.Roles);
    }

    private static MethodInfo? GetMethod(string name)
    {
        return typeof(WorkforceAccountsController).GetMethod(name);
    }
}
