using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccess;

/// <summary>
/// The workforce baseline is exactly one of Employee/Manager, applied additively:
/// it swaps only the opposite baseline slot and never disturbs HR Admin, Org Admin,
/// custom, or Tenant Administrator authority.
/// </summary>
public sealed class WorkforceBaselineServiceTests
{
    private static readonly Guid TenantAId = new("aaaaaaaa-0000-0000-0000-00000000000a");

    [Theory]
    [InlineData(0, WorkforceBaseline.Employee)]
    [InlineData(1, WorkforceBaseline.Manager)]
    [InlineData(7, WorkforceBaseline.Manager)]
    public void Recommendation_follows_direct_reports(int directReports, WorkforceBaseline expected)
        => Assert.Equal(expected, WorkforceBaselineRecommendation.FromDirectReports(directReports));

    private static async Task<(AppIdentityDbContext Db, TenantMembership Membership, Guid HrAdminId)> ArrangeAsync()
    {
        var db = TestDbContextFactory.CreateWithoutTenant(Guid.NewGuid().ToString());
        db.Tenants.Add(Tenant.Create(TenantId(), "Tenant A"));

        var employee = AccessProfile.Create(TenantId(), "Employee", null, AccessProfileTypes.SystemSeeded, true, "employee");
        var manager = AccessProfile.Create(TenantId(), "Manager", null, AccessProfileTypes.SystemSeeded, true, "manager");
        var hrAdmin = AccessProfile.Create(TenantId(), "HR Admin", null, AccessProfileTypes.SystemSeeded, true, "hr-admin");
        db.AccessProfiles.AddRange(employee, manager, hrAdmin);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "p@x.com",
            Email = "p@x.com",
            NormalizedEmail = "P@X.COM",
            NormalizedUserName = "P@X.COM",
            FirstName = "P",
            LastName = "Q",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        db.Users.Add(user);

        var membership = TenantMembership.Create(user.Id, TenantId());
        membership.BindEmployee(Guid.NewGuid());
        db.TenantMemberships.Add(membership);

        // The account already holds HR Admin — an unrelated, non-workforce authority.
        db.UserAccessProfiles.Add(UserAccessProfile.ForMembership(membership, hrAdmin.Id));
        await db.SaveChangesAsync();

        return (db, membership, hrAdmin.Id);
    }

    private static Guid TenantId() => TenantAId;

    private static Task<List<Guid>> AssignedProfileIdsAsync(AppIdentityDbContext db, Guid membershipId)
        => db.UserAccessProfiles.IgnoreQueryFilters()
            .Where(a => a.TenantMembershipId == membershipId)
            .Select(a => a.AccessProfileId)
            .ToListAsync();

    [Fact]
    public async Task Applying_manager_adds_manager_and_preserves_unrelated_authority()
    {
        var (db, membership, hrAdminId) = await ArrangeAsync();
        await using var _ = db;

        await new WorkforceBaselineService(db).ApplyAsync(membership, WorkforceBaseline.Manager, CancellationToken.None);
        await db.SaveChangesAsync();

        var managerId = await db.AccessProfiles.Where(p => p.InternalKey == "manager").Select(p => p.Id).SingleAsync();
        var assigned = await AssignedProfileIdsAsync(db, membership.Id);

        Assert.Contains(managerId, assigned);
        Assert.Contains(hrAdminId, assigned); // preserved
    }

    [Fact]
    public async Task Switching_baseline_swaps_only_the_workforce_slot()
    {
        var (db, membership, hrAdminId) = await ArrangeAsync();
        await using var _ = db;

        var service = new WorkforceBaselineService(db);
        await service.ApplyAsync(membership, WorkforceBaseline.Manager, CancellationToken.None);
        await db.SaveChangesAsync();
        await service.ApplyAsync(membership, WorkforceBaseline.Employee, CancellationToken.None);
        await db.SaveChangesAsync();

        var employeeId = await db.AccessProfiles.Where(p => p.InternalKey == "employee").Select(p => p.Id).SingleAsync();
        var managerId = await db.AccessProfiles.Where(p => p.InternalKey == "manager").Select(p => p.Id).SingleAsync();
        var assigned = await AssignedProfileIdsAsync(db, membership.Id);

        Assert.Contains(employeeId, assigned);
        Assert.DoesNotContain(managerId, assigned); // opposite slot removed
        Assert.Contains(hrAdminId, assigned); // still preserved
    }

    [Fact]
    public async Task Reapplying_same_baseline_is_idempotent()
    {
        var (db, membership, _) = await ArrangeAsync();
        await using var _ = db;

        var service = new WorkforceBaselineService(db);
        await service.ApplyAsync(membership, WorkforceBaseline.Employee, CancellationToken.None);
        await db.SaveChangesAsync();
        await service.ApplyAsync(membership, WorkforceBaseline.Employee, CancellationToken.None);
        await db.SaveChangesAsync();

        var employeeId = await db.AccessProfiles.Where(p => p.InternalKey == "employee").Select(p => p.Id).SingleAsync();
        var assigned = await AssignedProfileIdsAsync(db, membership.Id);

        Assert.Single(assigned, id => id == employeeId);
    }
}
