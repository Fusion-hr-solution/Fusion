using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using Xunit.Abstractions;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccess;

/// <summary>
/// The candidate read model decides account state from exact normalized work email
/// only, never mutates, and never discloses another tenant's identity. These tests
/// pin every bounded outcome from security §7.
/// </summary>
public sealed class WorkforceAccountCandidateResolverTests(ITestOutputHelper output)
{
    private static readonly Guid TenantA = new("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid TenantB = new("bbbbbbbb-0000-0000-0000-00000000000b");

    private static AppIdentityDbContext NewDb()
    {
        var db = TestDbContextFactory.CreateWithoutTenant(Guid.NewGuid().ToString());
        db.Tenants.Add(Tenant.Create(TenantA, "Tenant A"));
        db.Tenants.Add(Tenant.Create(TenantB, "Tenant B"));
        return db;
    }

    private static ApplicationUser AddAccount(AppIdentityDbContext db, string email)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant(),
            FirstName = "A",
            LastName = "B",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        db.Users.Add(user);
        return user;
    }

    private static async Task<WorkforceAccountCandidate> ResolveAsync(
        AppIdentityDbContext db, Guid employeeId, string email)
    {
        await db.SaveChangesAsync();
        return await new WorkforceAccountCandidateResolver(db)
            .ResolveAsync(TenantA, employeeId, email, CancellationToken.None);
    }

    [Fact]
    public async Task No_account_is_new_account()
    {
        await using var db = NewDb();
        var result = await ResolveAsync(db, Guid.NewGuid(), "nobody@x.com");
        Assert.Equal(WorkforceAccountCandidateOutcome.NewAccount, result.Outcome);
    }

    [Fact]
    public async Task Active_unbound_membership_here_is_ready_to_link()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "link@x.com");
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));

        var result = await ResolveAsync(db, Guid.NewGuid(), "link@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.ExistingAccountReadyToLink, result.Outcome);
        Assert.Equal(user.Id, result.UserId);
    }

    [Fact]
    public async Task Membership_already_bound_to_this_employee_is_active()
    {
        var employeeId = Guid.NewGuid();
        await using var db = NewDb();
        var user = AddAccount(db, "active@x.com");
        var membership = TenantMembership.Create(user.Id, TenantA);
        membership.BindEmployee(employeeId);
        db.TenantMemberships.Add(membership);

        var result = await ResolveAsync(db, employeeId, "active@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.Active, result.Outcome);
    }

    [Fact]
    public async Task Membership_bound_to_another_employee_is_binding_conflict()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "conflict@x.com");
        var membership = TenantMembership.Create(user.Id, TenantA);
        membership.BindEmployee(Guid.NewGuid()); // someone else
        db.TenantMemberships.Add(membership);

        var result = await ResolveAsync(db, Guid.NewGuid(), "conflict@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.BindingConflict, result.Outcome);
    }

    [Fact]
    public async Task Suspended_here_with_no_active_elsewhere_is_ready_to_reactivate()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "suspended@x.com");
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA, TenantMembershipStatus.Suspended));

        var result = await ResolveAsync(db, Guid.NewGuid(), "suspended@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.SuspendedAccountReadyToReactivate, result.Outcome);
    }

    [Fact]
    public async Task No_membership_here_and_none_active_elsewhere_can_join_tenant()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "join@x.com");
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantB, TenantMembershipStatus.Suspended));

        var result = await ResolveAsync(db, Guid.NewGuid(), "join@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.ExistingAccountReadyToJoinTenant, result.Outcome);
    }

    [Fact]
    public async Task Active_in_another_tenant_is_unavailable_and_discloses_nothing()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "elsewhere@x.com");
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantB));

        var result = await ResolveAsync(db, Guid.NewGuid(), "elsewhere@x.com");

        Assert.Equal(WorkforceAccountCandidateOutcome.AccountUnavailable, result.Outcome);
        Assert.Null(result.UserId);
        Assert.Null(result.MembershipId);
        Assert.Null(result.AccountEmail);
    }

    [Fact]
    public async Task Email_match_is_exact_and_case_insensitive_only()
    {
        await using var db = NewDb();
        var user = AddAccount(db, "Case@X.com");
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, TenantA));

        var result = await ResolveAsync(db, Guid.NewGuid(), "case@x.COM");

        Assert.Equal(WorkforceAccountCandidateOutcome.ExistingAccountReadyToLink, result.Outcome);
    }

    [Fact]
    public async Task Large_batch_preserves_every_subject_and_input_order()
    {
        await using var db = NewDb();
        var linkedEmployeeId = Guid.NewGuid();
        var linkedUser = AddAccount(db, "linked-batch@x.com");
        db.TenantMemberships.Add(TenantMembership.Create(linkedUser.Id, TenantA));
        await db.SaveChangesAsync();

        var subjects = Enumerable.Range(0, 420)
            .Select(index => new WorkforceAccountCandidateSubject(
                index == 211 ? linkedEmployeeId : Guid.NewGuid(),
                index == 211 ? "linked-batch@x.com" : $"batch-{index:D3}@x.com"))
            .ToList();

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var results = await new WorkforceAccountCandidateResolver(db)
            .ResolveManyAsync(TenantA, subjects, CancellationToken.None);
        stopwatch.Stop();
        output.WriteLine($"420-subject candidate resolution: {stopwatch.ElapsedMilliseconds} ms");

        Assert.Equal(subjects.Count, results.Count);
        Assert.Equal(subjects.Select(subject => subject.EmployeeId), results.Select(result => result.EmployeeId));
        Assert.Equal(WorkforceAccountCandidateOutcome.ExistingAccountReadyToLink, results[211].Outcome);
        Assert.All(results.Where((_, index) => index != 211), result =>
            Assert.Equal(WorkforceAccountCandidateOutcome.NewAccount, result.Outcome));
    }
}
