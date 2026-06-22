using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.Eligibility;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.Eligibility;

public sealed class EligibilityDecisionServiceTests
{
    [Fact]
    public void PacketAPermissions_AreKnownAndHaveLeastPrivilegeScopes()
    {
        Assert.True(CorePermissionCatalog.IsValidScope(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self));
        Assert.False(CorePermissionCatalog.IsValidScope(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Tenant));
        Assert.True(CorePermissionCatalog.IsValidScope(PerformancePermissions.ReviewTeamManage, PermissionScopes.DirectReports));
        Assert.True(CorePermissionCatalog.IsValidScope(PerformancePermissions.RetentionManage, PermissionScopes.Tenant));
        Assert.False(CorePermissionCatalog.IsValidScope(PerformancePermissions.RetentionManage, PermissionScopes.OrgUnit));
    }

    [Fact]
    public async Task EvaluateAsync_AllowsOrgScopedGrantWhenAnyActiveSubjectMembershipMatchesScope()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Eligibility Tenant");
        var user = CreateUser(tenant.Id);
        var profile = AccessProfile.Create(tenant.Id, "Scoped performance manager", null, AccessProfileTypes.Custom, false);
        var assignedOrgUnitId = Guid.NewGuid();

        db.AddRange(tenant, user, profile);
        db.AccessProfileGrants.Add(AccessProfileGrant.Create(
            tenant.Id, profile.Id, PerformancePermissions.CycleView, PermissionScopes.OrgUnit));
        db.UserAccessProfiles.Add(UserAccessProfile.Create(tenant.Id, user.Id, profile.Id));
        db.UserAccessProfileOrgUnitScopes.Add(UserAccessProfileOrgUnitScope.Create(
            tenant.Id, user.Id, profile.Id, assignedOrgUnitId));
        await db.SaveChangesAsync();

        var request = new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, Guid.NewGuid(), Guid.NewGuid(), false)
        {
            SubjectOrgUnitIds = [Guid.NewGuid(), assignedOrgUnitId]
        };

        var result = await new EligibilityDecisionService(db).EvaluateAsync(request);

        Assert.True(result.IsEligible);
    }

    [Fact]
    public async Task EvaluateAsync_AllowsActiveUserWithEffectivePermissionInsideAssignedOrgUnit()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Eligibility Tenant");
        var user = CreateUser(tenant.Id);
        var profile = AccessProfile.Create(tenant.Id, "Performance manager", null, AccessProfileTypes.Custom, false);
        var orgUnitId = Guid.NewGuid();

        db.AddRange(tenant, user, profile);
        db.AccessProfileGrants.Add(AccessProfileGrant.Create(tenant.Id, profile.Id, PerformancePermissions.CycleView, PermissionScopes.Tenant));
        db.UserAccessProfiles.Add(UserAccessProfile.Create(tenant.Id, user.Id, profile.Id));
        db.UserAccessProfileOrgUnitScopes.Add(UserAccessProfileOrgUnitScope.Create(tenant.Id, user.Id, profile.Id, orgUnitId));
        await db.SaveChangesAsync();

        var result = await new EligibilityDecisionService(db).EvaluateAsync(new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, Guid.NewGuid(), orgUnitId, false));

        Assert.True(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.None, result.DenialReason);
    }

    [Fact]
    public async Task EvaluateAsync_AllowsTenantPermissionRegardlessOfOptionalOrgUnitAssignments()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Eligibility Tenant");
        var user = CreateUser(tenant.Id);
        var profile = AccessProfile.Create(tenant.Id, "Performance manager", null, AccessProfileTypes.Custom, false);

        db.AddRange(tenant, user, profile);
        db.AccessProfileGrants.Add(AccessProfileGrant.Create(tenant.Id, profile.Id, PerformancePermissions.CycleView, PermissionScopes.Tenant));
        db.UserAccessProfiles.Add(UserAccessProfile.Create(tenant.Id, user.Id, profile.Id));
        db.UserAccessProfileOrgUnitScopes.Add(UserAccessProfileOrgUnitScope.Create(tenant.Id, user.Id, profile.Id, Guid.NewGuid()));
        await db.SaveChangesAsync();

        var result = await new EligibilityDecisionService(db).EvaluateAsync(new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, Guid.NewGuid(), Guid.NewGuid(), false));

        Assert.True(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.None, result.DenialReason);
    }

    [Fact]
    public async Task EvaluateAsync_DeniesOrgUnitScopedPermissionWhenProfileHasNoAssignedOrgUnit()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Eligibility Tenant");
        var user = CreateUser(tenant.Id);
        var profile = AccessProfile.Create(tenant.Id, "Scoped performance manager", null, AccessProfileTypes.Custom, false);

        db.AddRange(tenant, user, profile);
        db.AccessProfileGrants.Add(AccessProfileGrant.Create(
            tenant.Id, profile.Id, PerformancePermissions.CycleView, PermissionScopes.OrgUnit));
        db.UserAccessProfiles.Add(UserAccessProfile.Create(tenant.Id, user.Id, profile.Id));
        await db.SaveChangesAsync();

        var result = await new EligibilityDecisionService(db).EvaluateAsync(new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, Guid.NewGuid(), Guid.NewGuid(), false));

        Assert.False(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.OrgUnitOutOfScope, result.DenialReason);
    }

    private static ApplicationUser CreateUser(Guid tenantId) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        EmployeeId = Guid.NewGuid(),
        UserName = $"user-{Guid.NewGuid():N}@example.com",
        Email = $"user-{Guid.NewGuid():N}@example.com",
        FirstName = "Eligible",
        LastName = "Actor",
        IsActive = true,
    };
}
