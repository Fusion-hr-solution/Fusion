using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.WorkforceAccess;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace EY.HRPlatform.Identity.Tests.Controllers;

/// <summary>
/// The CoreHR-to-Identity workforce-access boundary is reachable only by a signed
/// internal caller. A browser cannot reach it to forge Employee facts, the tenant is a
/// trusted resolved input (never blank), and the candidate reply never discloses another
/// tenant's account identity. These tests pin all three at the controller.
/// </summary>
public sealed class InternalWorkforceAccessControllerTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [Fact]
    public async Task An_unsigned_caller_is_rejected()
    {
        // A real authorizer and a request with no internal signature — what a browser
        // reaching the boundary directly would send.
        var authorizer = new InternalServiceRequestAuthorizer(
            new MemoryCache(new MemoryCacheOptions()),
            new InternalServiceAuthenticationOptions
            {
                AllowedCallers = ["corehr"],
                Keys = { ["dev-1"] = "unit-test-internal-hmac-key-at-least-32-characters" },
            });

        var controller = new InternalWorkforceAccessController(authorizer, candidateResolver: null!, mutationService: null!, bindingService: null!)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var result = await controller.Candidates(
            new InternalWorkforceCandidatesRequest(Guid.NewGuid(), []), CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task A_missing_resolved_tenant_is_a_bad_request()
    {
        // Even a signed caller must supply a resolved tenant; the boundary never infers it.
        var controller = new InternalWorkforceAccessController(
            new AlwaysAuthorizedInternalCaller(), candidateResolver: null!, mutationService: null!, bindingService: null!)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var result = await controller.Candidates(
            new InternalWorkforceCandidatesRequest(Guid.Empty, []), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [SkippableFact]
    public async Task An_account_active_in_another_tenant_returns_unavailable_without_disclosing_identity()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var db = await _databases.CreateAsync("fusion_internal_access");

        var here = Guid.NewGuid();
        var elsewhere = Guid.NewGuid();
        db.Tenants.Add(Tenant.Create(here, "Atlas Group"));
        db.Tenants.Add(Tenant.Create(elsewhere, "Other Co"));

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "shared@other.example",
            Email = "shared@other.example",
            NormalizedEmail = "SHARED@OTHER.EXAMPLE",
            NormalizedUserName = "SHARED@OTHER.EXAMPLE",
            FirstName = "Shared",
            LastName = "Person",
            SecurityStamp = Guid.NewGuid().ToString(),
        };
        db.Users.Add(user);
        db.TenantMemberships.Add(TenantMembership.Create(user.Id, elsewhere, TenantMembershipStatus.Active));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var controller = new InternalWorkforceAccessController(
            new AlwaysAuthorizedInternalCaller(),
            new WorkforceAccountCandidateResolver(db),
            mutationService: null!, bindingService: null!)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var employeeId = Guid.NewGuid();
        var result = await controller.Candidates(
            new InternalWorkforceCandidatesRequest(here,
                [new InternalWorkforceCandidateSubject(employeeId, "shared@other.example")]),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var candidates = Assert.IsAssignableFrom<IReadOnlyList<WorkforceAccountCandidate>>(ok.Value);
        var candidate = Assert.Single(candidates);
        Assert.Equal(WorkforceAccountCandidateOutcome.AccountUnavailable, candidate.Outcome);
        Assert.Null(candidate.UserId);       // no other-tenant account identity
        Assert.Null(candidate.MembershipId);
        Assert.Null(candidate.AccountEmail);
    }

    private sealed class AlwaysAuthorizedInternalCaller : IInternalServiceRequestAuthorizer
    {
        public Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken)
            => Task.FromResult(true);
    }
}
