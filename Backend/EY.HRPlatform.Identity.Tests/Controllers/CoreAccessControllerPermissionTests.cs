using System.Security.Claims;
using EY.HRPlatform.Identity.Controllers;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.Identity.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Identity.Tests.Controllers;

public class CoreAccessControllerPermissionTests
{
    [Fact]
    public async Task GetProfiles_WithAccessViewPermission_ReturnsOk()
    {
        var controller = CreateController((CorePermissions.AccessView, PermissionScopes.Tenant));

        var result = await controller.GetProfiles(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task SetAssignments_WithAccessManagePermission_ReturnsOk()
    {
        var controller = CreateController((CorePermissions.AccessManage, PermissionScopes.Tenant));

        var result = await controller.SetAssignments(
            Guid.NewGuid(),
            new SetUserAccessProfilesRequest { AccessProfileIds = [] },
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task SetAssignmentsBulk_WithAccessManagePermission_ReturnsOk()
    {
        var controller = CreateController((CorePermissions.AccessManage, PermissionScopes.Tenant));

        var result = await controller.SetAssignmentsBulk(
            new BulkSetUserAccessProfilesRequest
            {
                UserIds = [Guid.NewGuid()],
                AccessProfileIds = [],
            },
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task SetAssignments_WithAccessViewPermission_ReturnsForbid()
    {
        var controller = CreateController((CorePermissions.AccessView, PermissionScopes.Tenant));

        var result = await controller.SetAssignments(
            Guid.NewGuid(),
            new SetUserAccessProfilesRequest { AccessProfileIds = [] },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task SetAssignmentsBulk_WithAccessViewPermission_ReturnsForbid()
    {
        var controller = CreateController((CorePermissions.AccessView, PermissionScopes.Tenant));

        var result = await controller.SetAssignmentsBulk(
            new BulkSetUserAccessProfilesRequest
            {
                UserIds = [Guid.NewGuid()],
                AccessProfileIds = [],
            },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task CreateProfile_WithOnlyAccessManagePermission_ReturnsForbid()
    {
        var controller = CreateController((CorePermissions.AccessManage, PermissionScopes.Tenant));

        var result = await controller.CreateProfile(
            new CreateAccessProfileRequest
            {
                Name = "Access Operator",
                Grants = [],
            },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task CreateProfile_WithAccessProfilesManagePermission_ReturnsCreated()
    {
        var controller = CreateController((CorePermissions.AccessProfilesManageV2, PermissionScopes.Tenant));

        var result = await controller.CreateProfile(
            new CreateAccessProfileRequest
            {
                Name = "Profile Definition Admin",
                Grants = [],
            },
            CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(result.Result);
    }

    [Fact]
    public async Task CreateProfile_WithPlatformAdminRole_ReturnsForbid()
    {
        var controller = CreateController(roles: [PlatformRole.PlatformAdmin]);

        var result = await controller.CreateProfile(
            new CreateAccessProfileRequest
            {
                Name = "Platform Access Operator",
                Grants = [],
            },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task GetAssignments_WithAssignmentsViewPermission_ReturnsOk()
    {
        var controller = CreateController((CorePermissions.AccessAssignmentsView, PermissionScopes.Tenant));

        var result = await controller.GetAssignments(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetCatalog_WithAccessProfilesViewPermission_ReturnsOk()
    {
        var controller = CreateController((CorePermissions.AccessProfilesView, PermissionScopes.Tenant));

        var result = await controller.GetCatalog(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
    }

    private static CoreAccessController CreateController(
        params (string PermissionKey, string Scope)[] grants)
        => CreateController(null, grants);

    private static CoreAccessController CreateController(
        IEnumerable<string>? roles = null,
        params (string PermissionKey, string Scope)[] grants)
    {
        var controller = new CoreAccessController(
            new StubAccessProfileService(),
            new StubAccessAuditService(),
            TestTenantContext.WithTenant(Guid.NewGuid()))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                        new Claim(ClaimTypes.Email, "controller.test@example.com"),
                        .. (roles ?? []).Select(role => new Claim(ClaimTypes.Role, role)),
                        .. grants.Select(grant => new Claim(
                            CustomClaimTypes.CorePermission,
                            CorePermissionClaimValue.Encode(grant.PermissionKey, grant.Scope))),
                    ], "TestAuth"))
                }
            }
        };

        return controller;
    }

    private sealed class StubAccessProfileService : IAccessProfileService
    {
        public Task EnsureSeedDataAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<CorePermissionCatalogItemDto>> GetPermissionCatalogAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<CorePermissionCatalogItemDto>>([]);

        public Task<IReadOnlyList<AccessProfileSummaryDto>> GetProfilesAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AccessProfileSummaryDto>>([
                new AccessProfileSummaryDto
                {
                    Id = Guid.NewGuid(),
                    Name = "Employee",
                    Type = AccessProfileTypes.SystemSeeded,
                    IsSystemProtected = true,
                }
            ]);

        public Task<AccessProfileSummaryDto?> GetProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default)
            => Task.FromResult<AccessProfileSummaryDto?>(new AccessProfileSummaryDto { Id = profileId, Name = "Employee" });

        public Task<AccessProfileSummaryDto> CreateProfileAsync(Guid tenantId, CreateAccessProfileRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new AccessProfileSummaryDto { Id = Guid.NewGuid(), Name = request.Name });

        public Task<AccessProfileSummaryDto> UpdateProfileAsync(Guid tenantId, Guid profileId, uint expectedVersion, UpdateAccessProfileRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new AccessProfileSummaryDto { Id = profileId, Name = request.Name ?? string.Empty });

        public Task DeleteProfileAsync(Guid tenantId, Guid profileId, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<UserAccessAssignmentDto>> GetUserAssignmentsAsync(Guid tenantId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserAccessAssignmentDto>>([]);

        public Task<UserAccessAssignmentDto> SetUserAccessProfilesAsync(Guid tenantId, Guid userId, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default)
            => Task.FromResult(new UserAccessAssignmentDto
            {
                UserId = userId,
                Email = "controller.test@example.com",
                FullName = "Controller Test",
                AccessProfiles = [],
            });

        public Task<IReadOnlyList<UserAccessAssignmentDto>> SetUserAccessProfilesBulkAsync(Guid tenantId, IReadOnlyCollection<Guid> userIds, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserAccessAssignmentDto>>(userIds.Select(userId => new UserAccessAssignmentDto
            {
                UserId = userId,
                Email = "controller.test@example.com",
                FullName = "Controller Test",
                AccessProfiles = [],
            }).ToList());

        public Task<CurrentUserAccessDto> GetCurrentUserAccessAsync(ApplicationUser user, CancellationToken cancellationToken = default)
            => Task.FromResult(new CurrentUserAccessDto());

        public Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetAssignedProfilesAsync(ApplicationUser user, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AccessProfileAssignmentSummaryDto>>([]);

        public Task<IReadOnlyList<EffectivePermissionGrant>> GetEffectivePermissionsAsync(ApplicationUser user, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<EffectivePermissionGrant>>([]);

        public Task SetInviteAccessProfilesAsync(Guid tenantId, Guid inviteId, IReadOnlyCollection<Guid> accessProfileIds, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<AccessProfileAssignmentSummaryDto>> GetInviteAccessProfilesAsync(Guid inviteId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AccessProfileAssignmentSummaryDto>>([]);

        public Task ApplyInviteProfilesAsync(InviteToken invite, ApplicationUser user, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SyncCompatibilityRolesAsync(ApplicationUser user, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public string ResolveCompatibilityRole(IReadOnlyCollection<EffectivePermissionGrant> grants)
            => PlatformRole.Employee;
    }

    private sealed class StubAccessAuditService : IAccessAuditService
    {
        public Task RecordAsync(
            Guid tenantId,
            string action,
            string resourceType,
            string? resourceId,
            string summary,
            object? before,
            object? after,
            ClaimsPrincipal actor,
            CancellationToken cancellationToken)
            => Task.CompletedTask;

        public Task<IReadOnlyList<AccessAuditEventDto>> GetRecentAsync(
            Guid tenantId,
            int take,
            CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<AccessAuditEventDto>>([]);
    }
}
