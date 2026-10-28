using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace EY.HRPlatform.Identity.Tests.Controllers;

/// <summary>
/// Core HR's Settings list asks Identity for the Roles section's last change (B-107): signed callers only, the
/// caller's tenant only, and a change to a role, never to who holds one.
/// </summary>
public sealed class InternalAccessAuditControllerTests : IAsyncLifetime
{
    private readonly RelationalTestDatabase _databases = new();
    private bool Available => _databases.Available;

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => _databases.DisposeAsync().AsTask();

    [Fact]
    public async Task An_unsigned_caller_is_rejected()
    {
        var authorizer = new InternalServiceRequestAuthorizer(
            new MemoryCache(new MemoryCacheOptions()),
            new InternalServiceAuthenticationOptions
            {
                AllowedCallers = ["corehr"],
                Keys = { ["dev-1"] = "unit-test-internal-hmac-key-at-least-32-characters" },
            });
        var controller = Controller(null!, authorizer, Guid.NewGuid());

        Assert.IsType<UnauthorizedResult>((await controller.LatestRoleChange(CancellationToken.None)).Result);
    }

    [Fact]
    public async Task A_missing_tenant_is_refused()
    {
        var controller = Controller(null!, new AlwaysAuthorizedInternalCaller(), null);

        Assert.IsType<BadRequestObjectResult>((await controller.LatestRoleChange(CancellationToken.None)).Result);
    }

    [SkippableFact]
    public async Task The_latest_role_change_is_the_callers_tenants_and_ignores_assignments()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var db = await _databases.CreateAsync("fusion_access_audit");
        var here = Guid.NewGuid();
        var elsewhere = Guid.NewGuid();
        db.Tenants.Add(Tenant.Create(here, "Atlas Group"));
        db.Tenants.Add(Tenant.Create(elsewhere, "Other Co"));
        await db.SaveChangesAsync();

        var controller = Controller(db, new AlwaysAuthorizedInternalCaller(), here);
        Assert.Null(Data(await controller.LatestRoleChange(CancellationToken.None)));

        db.AccessAuditEvents.Add(Event(here, "Amira Khelifi", "access.profile.updated", "AccessProfile"));
        await db.SaveChangesAsync();
        await Task.Delay(20);
        db.AccessAuditEvents.Add(Event(here, "Someone Later", "access.assignment.updated", "UserAccessAssignment"));
        db.AccessAuditEvents.Add(Event(elsewhere, "Other Admin", "access.profile.created", "AccessProfile"));
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var latest = Data(await controller.LatestRoleChange(CancellationToken.None));
        Assert.NotNull(latest);
        Assert.Equal("Amira Khelifi", latest!.ActorName);
    }

    private static InternalRoleChangeDto? Data(ActionResult<ApiResponse<InternalRoleChangeDto?>> result)
        => Assert.IsType<ApiResponse<InternalRoleChangeDto?>>(Assert.IsType<OkObjectResult>(result.Result).Value).Data;

    private static AccessAuditEvent Event(Guid tenantId, string actor, string action, string resourceType)
        => AccessAuditEvent.Create(tenantId, Guid.NewGuid(), actor, "TenantAdmin", action, resourceType, Guid.NewGuid().ToString(),
            "Changed.", null, null, null);

    private static InternalAccessAuditController Controller(
        AppIdentityDbContext db, IInternalServiceRequestAuthorizer authorizer, Guid? tenantId)
    {
        var controller = new InternalAccessAuditController(db, authorizer)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        if (tenantId is Guid id) controller.HttpContext.Request.Headers["X-Tenant-Id"] = id.ToString();
        return controller;
    }

    private sealed class AlwaysAuthorizedInternalCaller : IInternalServiceRequestAuthorizer
    {
        public Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken)
            => Task.FromResult(true);
    }
}
