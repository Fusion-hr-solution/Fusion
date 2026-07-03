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
        Assert.False(_policy.CanActOnOwnedException(user));
        Assert.False(_policy.CanOverrideException(user));
        Assert.False(_policy.CanViewExceptionAudit(user));
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
    public void PlatformAdmin_IsAllowedCycleOperations_ButNotTenantTemplateLibrary()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.True(_policy.CanViewCycles(user));
        Assert.True(_policy.CanManageCycles(user));
        Assert.True(_policy.CanOperateCycles(user));
        Assert.True(_policy.CanActOnOwnedException(user));
        Assert.True(_policy.CanOverrideException(user));
        Assert.True(_policy.CanViewExceptionAudit(user));

        // Tenant template content is tenant-owned (P1.1 §6.1): no implicit platform access.
        Assert.False(_policy.CanViewObjectiveLibrary(user));
        Assert.False(_policy.CanManageObjectiveLibrary(user));
    }

    [Fact]
    public void ExceptionActionGrant_AllowsOwnerActionOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ExceptionAction, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanActOnOwnedException(user));
        Assert.False(_policy.CanOverrideException(user));
        Assert.False(_policy.CanViewExceptionAudit(user));
    }

    // ─── P1 policy-and-templates checks ──────────────────────────────────────

    [Fact]
    public void Anonymous_IsDeniedPolicyAndTemplateChecks()
    {
        var user = ClaimsPrincipalBuilder.Anonymous();

        Assert.False(_policy.CanViewObjectivePolicy(user));
        Assert.False(_policy.CanManageObjectivePolicy(user));
        Assert.False(_policy.CanManageTemplateCategories(user));
        Assert.False(_policy.CanManagePlatformDefaults(user));
    }

    [Fact]
    public void ObjectivePolicyViewGrant_AllowsViewOnly()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyView, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewObjectivePolicy(user));
        Assert.False(_policy.CanManageObjectivePolicy(user));
    }

    [Fact]
    public void ObjectivePolicyManageGrant_AllowsViewAndManage()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanViewObjectivePolicy(user));
        Assert.True(_policy.CanManageObjectivePolicy(user));
    }

    [Fact]
    public void TemplateCategoryManageGrant_AllowsCategoryManage()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.TemplateCategoryManage, PermissionScopes.Tenant)
            .Build();

        Assert.True(_policy.CanManageTemplateCategories(user));
        Assert.False(_policy.CanManageObjectivePolicy(user));
    }

    [Fact]
    public void PlatformAdminRole_AllowsPlatformDefaultsOnly_NotTenantPolicyChecks()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithRole(PlatformRole.PlatformAdmin)
            .Build();

        Assert.True(_policy.CanManagePlatformDefaults(user));
        // PlatformAdmin does not implicitly get tenant-scoped policy/category — deny-by-default
        Assert.False(_policy.CanViewObjectivePolicy(user));
        Assert.False(_policy.CanManageObjectivePolicy(user));
        Assert.False(_policy.CanManageTemplateCategories(user));
    }

    [Fact]
    public void TenantPolicyManage_DoesNotGrantPlatformDefaults()
    {
        var user = new ClaimsPrincipalBuilder()
            .WithPermission(PerformancePermissions.ObjectivePolicyManage, PermissionScopes.Tenant)
            .Build();

        Assert.False(_policy.CanManagePlatformDefaults(user));
    }
}
