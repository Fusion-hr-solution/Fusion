using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;

namespace EY.HRPlatform.CoreHR.Tests.Features.Workforce;

public class WorkforceControllerAuthorizationTests
{
    private const string WorkforceReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin + "," + PlatformRole.Employee + "," + PlatformRole.Manager;
    private const string OrgUnitReadRoles = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin;

    [Fact]
    public void GetCurrentContext_AllowsWorkforceReadRoles()
    {
        var method = typeof(WorkforceController).GetMethod(nameof(WorkforceController.GetCurrentContext));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(WorkforceReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetEmployee_AllowsWorkforceReadRoles()
    {
        var method = typeof(WorkforceController).GetMethod(nameof(WorkforceController.GetEmployee));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(WorkforceReadRoles, authorize!.Roles);
    }

    [Fact]
    public void GetPublishedOrgUnits_RequiresHrAdminRole()
    {
        var method = typeof(WorkforceController).GetMethod(nameof(WorkforceController.GetPublishedOrgUnits));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.NotNull(authorize);
        Assert.Equal(OrgUnitReadRoles, authorize!.Roles);
    }
}
