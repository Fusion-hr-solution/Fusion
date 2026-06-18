using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests.Features.Security;

public class PerformanceAccessPolicyServiceTests
{
    private readonly PerformanceAccessPolicyService _policy = new();

    [Fact]
    public void Anonymous_IsDeniedEverything()
    {
        var user = ClaimsPrincipalBuilder.Anonymous();

        Assert.False(_policy.CanViewCycles(user));
        Assert.False(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
        Assert.False(_policy.CanViewObjectiveLibrary(user));
        Assert.False(_policy.CanManageObjectiveLibrary(user));
    }

    [Fact]
    public void CycleViewGrant_AllowsViewOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.False(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
    }

    [Fact]
    public void CycleManageGrant_AllowsManageAndView()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CycleManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.True(_policy.CanManageCycles(user));
        Assert.False(_policy.CanOperateCycles(user));
    }

    [Fact]
    public void CyclePublishGrant_AllowsOperate()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.CyclePublish, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanOperateCycles(user));
        Assert.True(_policy.CanViewCycles(user));
    }

    [Fact]
    public void ObjectiveLibraryManageGrant_AllowsManageAndView()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectiveLibraryManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewObjectiveLibrary(user));
        Assert.True(_policy.CanManageObjectiveLibrary(user));
    }

    [Fact]
    public void PlatformAdmin_IsAllowedEverything()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.True(_policy.CanManageCycles(user));
        Assert.True(_policy.CanOperateCycles(user));
        Assert.True(_policy.CanViewObjectiveLibrary(user));
        Assert.True(_policy.CanManageObjectiveLibrary(user));
    }
}
