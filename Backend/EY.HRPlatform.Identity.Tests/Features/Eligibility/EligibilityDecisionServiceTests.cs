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

    // -----------------------------------------------------------------------
    // Deny-by-default and fail-closed tests
    // -----------------------------------------------------------------------

    [Fact]
    public async Task EvaluateAsync_DeniesWithPermissionMissing_WhenNoMatchingGrantExists()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Deny Tenant");
        var user = CreateUser(tenant.Id);

        // Seed tenant and active user but NO AccessProfileGrant.
        db.AddRange(tenant, user);
        await db.SaveChangesAsync();

        var request = new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, null, null, false);

        var result = await new EligibilityDecisionService(db).EvaluateAsync(request);

        Assert.False(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.PermissionMissing, result.DenialReason);
    }

    [Fact]
    public async Task EvaluateAsync_DeniesWithTenantInactive_WhenTenantIsArchivedOrInactive()
    {
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Inactive Tenant");
        tenant.Deactivate();                       // IsActive = false
        var user = CreateUser(tenant.Id);

        // Seed an access profile and grant that would normally allow the permission,
        // to prove the tenant check fires before any grant evaluation.
        var profile = AccessProfile.Create(tenant.Id, "Full access", null, AccessProfileTypes.Custom, false);
        db.AddRange(tenant, user, profile);
        db.AccessProfileGrants.Add(AccessProfileGrant.Create(
            tenant.Id, profile.Id, PerformancePermissions.CycleView, PermissionScopes.Tenant));
        db.UserAccessProfiles.Add(UserAccessProfile.Create(tenant.Id, user.Id, profile.Id));
        await db.SaveChangesAsync();

        var request = new EligibilityEvaluationRequest(
            tenant.Id, user.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user.EmployeeId, null, null, false);

        var result = await new EligibilityDecisionService(db).EvaluateAsync(request);

        Assert.False(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.TenantInactive, result.DenialReason);

        // Also verify archived tenant (IsActive=false AND IsArchived=true) is denied.
        await using var db2 = TestDbContextFactory.CreateWithoutTenant();
        var archivedTenant = Tenant.Create(Guid.NewGuid(), "Archived Tenant");
        archivedTenant.Archive();                  // IsArchived = true, IsActive = false
        var user2 = CreateUser(archivedTenant.Id);

        db2.AddRange(archivedTenant, user2);
        await db2.SaveChangesAsync();

        var request2 = new EligibilityEvaluationRequest(
            archivedTenant.Id, user2.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            user2.EmployeeId, null, null, false);

        var result2 = await new EligibilityDecisionService(db2).EvaluateAsync(request2);

        Assert.False(result2.IsEligible);
        Assert.Equal(EligibilityDenialReason.TenantInactive, result2.DenialReason);
    }

    [Fact]
    public async Task EvaluateAsync_DeniesWithAccountInactive_WhenUserIsInactiveOrLockedOut()
    {
        // --- Part 1: IsActive = false ---
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        var tenant = Tenant.Create(Guid.NewGuid(), "Active Tenant For Inactive User");
        var inactiveUser = CreateUser(tenant.Id);
        inactiveUser.IsActive = false;

        db.AddRange(tenant, inactiveUser);
        await db.SaveChangesAsync();

        var request = new EligibilityEvaluationRequest(
            tenant.Id, inactiveUser.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            inactiveUser.EmployeeId, null, null, false);

        var result = await new EligibilityDecisionService(db).EvaluateAsync(request);

        Assert.False(result.IsEligible);
        Assert.Equal(EligibilityDenialReason.AccountInactive, result.DenialReason);

        // --- Part 2: LockoutEnd in the future ---
        await using var db2 = TestDbContextFactory.CreateWithoutTenant();
        var tenant2 = Tenant.Create(Guid.NewGuid(), "Active Tenant For Locked User");
        var lockedUser = CreateUser(tenant2.Id);
        lockedUser.LockoutEnd = DateTimeOffset.UtcNow.AddHours(1);

        db2.AddRange(tenant2, lockedUser);
        await db2.SaveChangesAsync();

        var request2 = new EligibilityEvaluationRequest(
            tenant2.Id, lockedUser.Id, PerformancePermissions.CycleView, "performance.cycle.read",
            lockedUser.EmployeeId, null, null, false);

        var result2 = await new EligibilityDecisionService(db2).EvaluateAsync(request2);

        Assert.False(result2.IsEligible);
        Assert.Equal(EligibilityDenialReason.AccountInactive, result2.DenialReason);
    }

    [Fact]
    public async Task EvaluateAsync_DeniesWithoutDatabaseAccess_WhenRequestIsMalformed()
    {
        // Guid.Empty TenantId — the guard fires before any DB query.
        await using var db = TestDbContextFactory.CreateWithoutTenant();
        // Do NOT seed any data to confirm no DB access occurs.

        var emptyTenantRequest = new EligibilityEvaluationRequest(
            Guid.Empty, Guid.NewGuid(), PerformancePermissions.CycleView, "performance.cycle.read",
            null, null, null, false);

        var result1 = await new EligibilityDecisionService(db).EvaluateAsync(emptyTenantRequest);
        Assert.False(result1.IsEligible);
        Assert.Equal(EligibilityDenialReason.PermissionMissing, result1.DenialReason);

        // Blank PermissionKey.
        var blankPermissionRequest = new EligibilityEvaluationRequest(
            Guid.NewGuid(), Guid.NewGuid(), "   ", "performance.cycle.read",
            null, null, null, false);

        var result2 = await new EligibilityDecisionService(db).EvaluateAsync(blankPermissionRequest);
        Assert.False(result2.IsEligible);
        Assert.Equal(EligibilityDenialReason.PermissionMissing, result2.DenialReason);

        // Blank Action.
        var blankActionRequest = new EligibilityEvaluationRequest(
            Guid.NewGuid(), Guid.NewGuid(), PerformancePermissions.CycleView, "   ",
            null, null, null, false);

        var result3 = await new EligibilityDecisionService(db).EvaluateAsync(blankActionRequest);
        Assert.False(result3.IsEligible);
        Assert.Equal(EligibilityDenialReason.PermissionMissing, result3.DenialReason);
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
