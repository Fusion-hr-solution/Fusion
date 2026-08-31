using System.Security.Claims;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.TenantAdministration;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.Identity.Models.WorkforceAccounts;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Tests.Controllers;

public sealed class WorkforceAccountStatusReadPurityTests
{
    [Fact]
    public async Task MatchingSameTenantUser_ReturnsConflictWithoutLinkingOrChangingMemberships()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var user = AddUser(db, tenantId, "person@example.com");
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var beforeMemberships = await db.TenantMemberships.IgnoreQueryFilters().CountAsync();
        var response = await ReadAsync(db, tenantId, Subject(employeeId, "person@example.com"));

        Assert.Equal("Conflict", response.ProvisioningState);
        Assert.Equal("MatchingAccountRequiresExplicitLink", response.Conflict?.Kind);
        Assert.Null(await db.Users.IgnoreQueryFilters().Where(x => x.Id == user.Id).Select(x => x.EmployeeId).SingleAsync());
        Assert.Equal(beforeMemberships, await db.TenantMemberships.IgnoreQueryFilters().CountAsync());
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task MatchingSameTenantInvitation_ReturnsConflictWithoutLinking()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var invite = InviteToken.Create(
            "invite@example.com", tenantId, PlatformRole.Employee, Guid.NewGuid());
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var response = await ReadAsync(db, tenantId, Subject(employeeId, "invite@example.com"));

        Assert.Equal("Conflict", response.ProvisioningState);
        Assert.Equal("MatchingInvitationRequiresExplicitLink", response.Conflict?.Kind);
        Assert.Null(await db.InviteTokens.IgnoreQueryFilters()
            .Where(x => x.Id == invite.Id).Select(x => x.EmployeeId).SingleAsync());
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task ExplicitlyLinkedUser_RemainsAuthoritativeAndReadOnly()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var user = AddUser(db, tenantId, "linked@example.com", employeeId);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var response = await ReadAsync(db, tenantId, Subject(employeeId, "linked@example.com"));

        Assert.Equal("Active", response.ProvisioningState);
        Assert.Equal(user.Id, response.UserId);
        Assert.Equal(employeeId, await db.TenantMemberships.IgnoreQueryFilters()
            .Where(x => x.UserId == user.Id && x.TenantId == tenantId)
            .Select(x => x.EmployeeId)
            .SingleAsync());
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task StaleGlobalEmployeeId_IsIgnoredInFavorOfTenantMembershipBinding()
    {
        var tenantId = Guid.NewGuid();
        var staleEmployeeId = Guid.NewGuid();
        var currentEmployeeId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var user = AddUser(db, tenantId, "corrected@example.com", currentEmployeeId);
        user.EmployeeId = staleEmployeeId;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var current = await ReadAsync(db, tenantId, Subject(currentEmployeeId, "corrected@example.com"));
        var stale = await ReadAsync(db, tenantId, Subject(staleEmployeeId, "corrected@example.com"));

        Assert.Equal("Active", current.ProvisioningState);
        Assert.Equal(user.Id, current.UserId);
        Assert.Equal("Conflict", stale.ProvisioningState);
        Assert.Equal("EmployeeEmailMismatch", stale.Conflict?.Kind);
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task CrossTenantEmailMatch_IsNotDisclosedOrLinked()
    {
        var tenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var user = AddUser(db, otherTenantId, "cross@example.com");
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var response = await ReadAsync(db, tenantId, Subject(employeeId, "cross@example.com"));

        Assert.Equal("Unprovisioned", response.ProvisioningState);
        Assert.Null(response.UserId);
        Assert.Null(response.Conflict);
        Assert.Null(await db.Users.IgnoreQueryFilters().Where(x => x.Id == user.Id).Select(x => x.EmployeeId).SingleAsync());
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task BlankEmailBatch_IsRejectedWithoutIdentityMutation()
    {
        var tenantId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var controller = CreateController(db, tenantId);

        var result = await controller.GetStatuses(new WorkforceAccountStatusesRequest
        {
            Subjects = [Subject(Guid.NewGuid(), string.Empty)]
        }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.False(db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task Large_status_batch_returns_one_read_only_result_per_subject_in_order()
    {
        var tenantId = Guid.NewGuid();
        await using var db = CreateDb(tenantId);
        var subjects = Enumerable.Range(0, 420)
            .Select(index => Subject(Guid.NewGuid(), $"status-{index:D3}@example.com"))
            .ToList();
        var controller = CreateController(db, tenantId);

        var result = await controller.GetStatuses(new WorkforceAccountStatusesRequest
        {
            Subjects = subjects
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<List<WorkforceAccountStatusDto>>>(ok.Value);
        Assert.NotNull(envelope.Data);
        Assert.Equal(subjects.Count, envelope.Data.Count);
        Assert.Equal(subjects.Select(subject => subject.EmployeeId), envelope.Data.Select(status => status.EmployeeId));
        Assert.All(envelope.Data, status => Assert.Equal("Unprovisioned", status.ProvisioningState));
        Assert.False(db.ChangeTracker.HasChanges());
    }

    private static AppIdentityDbContext CreateDb(Guid tenantId)
        => TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));

    private static ApplicationUser AddUser(
        AppIdentityDbContext db,
        Guid tenantId,
        string email,
        Guid? employeeId = null)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Test",
            LastName = "Person",
            EmployeeId = employeeId,
            IsActive = true,
        };
        db.Users.Add(user);
        var membership = TenantMembership.Create(user.Id, tenantId);
        if (employeeId.HasValue)
        {
            membership.BindEmployee(employeeId.Value);
        }
        db.TenantMemberships.Add(membership);
        return user;
    }

    private static WorkforceAccountSubjectDto Subject(Guid employeeId, string email) => new()
    {
        EmployeeId = employeeId,
        Email = email,
        FirstName = "Test",
        LastName = "Person",
    };

    private static async Task<WorkforceAccountStatusDto> ReadAsync(
        AppIdentityDbContext db,
        Guid tenantId,
        WorkforceAccountSubjectDto subject)
    {
        var controller = CreateController(db, tenantId);
        var result = await controller.GetStatuses(new WorkforceAccountStatusesRequest
        {
            Subjects = [subject]
        }, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<List<WorkforceAccountStatusDto>>>(ok.Value);
        return Assert.Single(envelope.Data!);
    }

    private static WorkforceAccountsController CreateController(AppIdentityDbContext db, Guid tenantId)
    {
        var userManager = RelationalTestDatabase.CreateUserManager(db);
        var httpContext = new DefaultHttpContext();
        // The boundary is HMAC-internal now: the tenant is the trusted signed header,
        // and authorization is the internal signature, not a JWT permission claim.
        httpContext.Request.Headers["X-Tenant-Id"] = tenantId.ToString();

        var controller = new WorkforceAccountsController(
            db,
            new AccessProfileService(db, userManager),
            new ConfigurationBuilder().AddInMemoryCollection().Build(),
            new TenantContinuityCommandExecutor(db),
            new AlwaysAuthorizedInternalCaller(),
            null!)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };

        return controller;
    }

    // The signature is verified by the shared authorizer in production; these read-purity
    // tests exercise the handler behind an already-authorized internal caller.
    private sealed class AlwaysAuthorizedInternalCaller : IInternalServiceRequestAuthorizer
    {
        public Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }
}
