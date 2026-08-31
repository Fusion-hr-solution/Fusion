using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.Membership;
using EY.HRPlatform.Identity.Features.WorkforceBinding;
using EY.HRPlatform.Identity.Infrastructure.Core;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceBinding;

/// <summary>
/// The legacy-binding backfill migrates <c>ApplicationUser.EmployeeId</c> onto the
/// membership-scoped authority using CoreHR-verified ownership only. These tests pin
/// the determinism rules: bind exactly one verified match, and report — never guess —
/// missing, unverifiable, zero, or multiple matches. They also prove the claims
/// cutover reads the Employee from the membership binding, not the account scalar.
/// </summary>
public sealed class WorkforceBindingBackfillServiceTests
{
    private static readonly Guid TenantA = new("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid TenantB = new("bbbbbbbb-0000-0000-0000-00000000000b");
    private static readonly Guid TenantC = new("cccccccc-0000-0000-0000-00000000000c");

    private sealed class StubDirectory : ICoreWorkforceDirectory
    {
        private readonly HashSet<(Guid Tenant, Guid Employee)> _owned;

        public StubDirectory(params (Guid Tenant, Guid Employee)[] owned) => _owned = [.. owned];

        public Task<IReadOnlyDictionary<Guid, CoreEmployeeFacts>> ResolveOwnedEmployeesAsync(
            Guid tenantId, IReadOnlyCollection<Guid> employeeIds, DateTime asOf, CancellationToken cancellationToken)
        {
            IReadOnlyDictionary<Guid, CoreEmployeeFacts> result = employeeIds
                .Where(employeeId => _owned.Contains((tenantId, employeeId)))
                .ToDictionary(
                    employeeId => employeeId,
                    employeeId => new CoreEmployeeFacts(employeeId, "Person", "Person Name", "person@x.com", true));

            return Task.FromResult(result);
        }
    }

    private static ApplicationUser CreateAccount(Guid employeeId)
    {
        var email = $"user-{Guid.NewGuid():N}@example.com";
        return new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            FirstName = "Test",
            LastName = "User",
            EmployeeId = employeeId,
            SecurityStamp = Guid.NewGuid().ToString(),
        };
    }

    private static AppIdentityDbContext NewDb()
    {
        var db = TestDbContextFactory.CreateWithoutTenant(Guid.NewGuid().ToString());
        db.Tenants.Add(Tenant.Create(TenantA, "Tenant A"));
        db.Tenants.Add(Tenant.Create(TenantB, "Tenant B"));
        db.Tenants.Add(Tenant.Create(TenantC, "Tenant C"));
        return db;
    }

    [Fact]
    public async Task Single_verified_owner_membership_is_bound()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));
        await db.SaveChangesAsync();

        var report = await new WorkforceBindingBackfillService(db, new StubDirectory((TenantA, employeeId)))
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(1, report.BoundCount);
        Assert.Empty(report.Conflicts);
        var membership = await db.TenantMemberships.SingleAsync(m => m.UserId == user.Id);
        Assert.Equal(employeeId, membership.EmployeeId);
    }

    [Fact]
    public async Task Active_membership_that_does_not_own_the_employee_is_not_bound()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        // Active in B, but CoreHR verifies the Employee belongs to A (which the user is not in).
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantB));
        await db.SaveChangesAsync();

        var report = await new WorkforceBindingBackfillService(db, new StubDirectory((TenantA, employeeId)))
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(0, report.BoundCount);
        var conflict = Assert.Single(report.Conflicts);
        Assert.Equal(WorkforceBindingConflictReason.OwnerNotVerified, conflict.Reason);
        var membership = await db.TenantMemberships.SingleAsync(m => m.UserId == user.Id);
        Assert.Null(membership.EmployeeId);
    }

    [Fact]
    public async Task Binds_verified_owner_even_when_the_verified_membership_is_suspended()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA, TenantMembershipStatus.Suspended));
        await db.SaveChangesAsync();

        var report = await new WorkforceBindingBackfillService(db, new StubDirectory((TenantA, employeeId)))
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(1, report.BoundCount);
        var membership = await db.TenantMemberships.SingleAsync(m => m.UserId == user.Id);
        Assert.Equal(employeeId, membership.EmployeeId);
        Assert.Equal(TenantMembershipStatus.Suspended, membership.Status); // not reactivated
    }

    [Fact]
    public async Task Unverifiable_owner_reports_conflict_and_does_not_guess()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));
        await db.SaveChangesAsync();

        // CoreHR confirms nothing.
        var report = await new WorkforceBindingBackfillService(db, new StubDirectory())
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(0, report.BoundCount);
        Assert.Equal(WorkforceBindingConflictReason.OwnerNotVerified, Assert.Single(report.Conflicts).Reason);
    }

    [Fact]
    public async Task Multiple_verified_owner_memberships_report_conflict()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantC, TenantMembershipStatus.Suspended));
        await db.SaveChangesAsync();

        // Ambiguous: two tenants both claim ownership.
        var report = await new WorkforceBindingBackfillService(
                db, new StubDirectory((TenantA, employeeId), (TenantC, employeeId)))
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(0, report.BoundCount);
        Assert.Equal(WorkforceBindingConflictReason.MultipleMatchingMemberships, Assert.Single(report.Conflicts).Reason);
    }

    [Fact]
    public async Task Already_bound_membership_is_skipped()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        var membership = TenantMembership.Create(user.Id, TenantA);
        membership.BindEmployee(employeeId);
        db.TenantMemberships.Add(membership);
        await db.SaveChangesAsync();

        var report = await new WorkforceBindingBackfillService(db, new StubDirectory((TenantA, employeeId)))
            .BackfillAsync(apply: true, CancellationToken.None);

        Assert.Equal(0, report.BoundCount);
        Assert.Equal(1, report.AlreadyBoundCount);
        Assert.Empty(report.Conflicts);
    }

    [Fact]
    public async Task Dry_run_computes_without_persisting()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));
        await db.SaveChangesAsync();

        var report = await new WorkforceBindingBackfillService(db, new StubDirectory((TenantA, employeeId)))
            .BackfillAsync(apply: false, CancellationToken.None);

        Assert.Equal(1, report.BoundCount);
        db.ChangeTracker.Clear();
        var membership = await db.TenantMemberships.SingleAsync(m => m.UserId == user.Id);
        Assert.Null(membership.EmployeeId);
    }

    [Fact]
    public async Task Claims_cutover_reads_employee_from_the_membership_binding_not_the_account_scalar()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = CreateAccount(employeeId);
        user.EmployeeId = null; // no legacy scalar: identity must come from the binding
        db.Users.Add(user);
        var membership = TenantMembership.Create(user.Id, TenantA);
        membership.BindEmployee(employeeId);
        db.TenantMemberships.Add(membership);
        db.TenantModuleEntitlements.Add(TenantModuleEntitlement.Create(TenantA, TenantModule.CoreHR));
        await db.SaveChangesAsync();

        var resolver = new CustomerContextResolver(db, RelationalTestDatabase.CreateUserManager(db));
        var result = await resolver.ResolveAsync(user);

        Assert.True(result.IsAuthoritative);
        Assert.Equal(employeeId, result.Context!.EmployeeId);
    }
}
