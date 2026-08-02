using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Features.WorkforceAccounts;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.Identity.Models.WorkforceAccounts;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/corehr/employees/workforce-accounts")]
[Authorize]
public sealed class WorkforceAccountsController(
    AppIdentityDbContext dbContext,
    IAccessProfileService accessProfileService,
    ITenantContext tenantContext,
    IConfiguration configuration,
    IWorkforceInvitationEmailSender workforceInvitationEmailSender) : ControllerBase
{
    private const string StateUnprovisioned = "Unprovisioned";
    private const string StateInvitePending = "InvitePending";
    private const string StateInviteExpired = "InviteExpired";
    private const string StateInviteRevoked = "InviteRevoked";
    private const string StateInviteAccepted = "InviteAccepted";
    private const string StateActive = "Active";
    private const string StateInactive = "Inactive";
    private const string StateConflict = "Conflict";

    private const string OutcomeCreated = "Created";
    private const string OutcomePending = "Pending";
    private const string OutcomeActive = "Active";
    private const string OutcomeInactive = "Inactive";
    private const string OutcomeConflict = "Conflict";

    [HttpGet("summary")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountSummaryDto>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountSummaryDto>>> GetSummary(
        CancellationToken cancellationToken)
    {
        if (!CanViewWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountSummaryDto>.Failure(tenantError));

        var now = DateTime.UtcNow;
        var userSnapshots = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.TenantMemberships.Any(m => m.TenantId == tenantId && m.Status == TenantMembershipStatus.Active) && user.EmployeeId.HasValue)
            .Select(user => new
            {
                EmployeeId = user.EmployeeId!.Value,
                user.IsActive,
            })
            .ToListAsync(cancellationToken);

        var userEmployeeIds = userSnapshots
            .Select(user => user.EmployeeId)
            .ToHashSet();

        var latestInvites = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId && invite.EmployeeId.HasValue)
            .Select(invite => new
            {
                EmployeeId = invite.EmployeeId!.Value,
                invite.IsUsed,
                invite.IsRevoked,
                invite.ExpiresAt,
                invite.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        var latestInviteByEmployeeId = latestInvites
            .Where(invite => !userEmployeeIds.Contains(invite.EmployeeId))
            .GroupBy(invite => invite.EmployeeId)
            .Select(group => group
                .OrderByDescending(invite => invite.CreatedAt)
                .First())
            .ToList();

        var activeAccountCount = userSnapshots.Count(user => user.IsActive);
        var inactiveAccountCount = userSnapshots.Count(user => !user.IsActive);
        var pendingInviteCount = latestInviteByEmployeeId.Count(invite =>
            !invite.IsUsed &&
            !invite.IsRevoked &&
            invite.ExpiresAt > now);
        var acceptedInviteCount = latestInviteByEmployeeId.Count(invite => invite.IsUsed);
        var expiredInviteCount = latestInviteByEmployeeId.Count(invite =>
            !invite.IsUsed &&
            !invite.IsRevoked &&
            invite.ExpiresAt <= now);
        var revokedInviteCount = latestInviteByEmployeeId.Count(invite =>
            !invite.IsUsed &&
            invite.IsRevoked);

        var response = new WorkforceAccountSummaryDto
        {
            ActiveAccountCount = activeAccountCount,
            InactiveAccountCount = inactiveAccountCount,
            PendingInviteCount = pendingInviteCount,
            AcceptedInviteCount = acceptedInviteCount,
            ExpiredInviteCount = expiredInviteCount,
            RevokedInviteCount = revokedInviteCount,
            TrackedEmployeeCount = activeAccountCount
                + inactiveAccountCount
                + pendingInviteCount
                + acceptedInviteCount
                + expiredInviteCount
                + revokedInviteCount,
            AttentionQueueCount = inactiveAccountCount
                + acceptedInviteCount
                + expiredInviteCount
                + revokedInviteCount,
        };

        return Ok(ApiResponse<WorkforceAccountSummaryDto>.Success(response));
    }

    [HttpPost("statuses")]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountStatusDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountStatusDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<List<WorkforceAccountStatusDto>>>> GetStatuses(
        [FromBody] WorkforceAccountStatusesRequest request,
        CancellationToken cancellationToken)
    {
        if (!CanViewWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<List<WorkforceAccountStatusDto>>.Failure(tenantError));

        var validationError = ValidateSubjects(request.Subjects);
        if (validationError is not null)
            return BadRequest(ApiResponse<List<WorkforceAccountStatusDto>>.Failure(validationError));

        var statuses = new List<WorkforceAccountStatusDto>();
        foreach (var subject in DistinctSubjects(request.Subjects))
        {
            statuses.Add(await ResolveStatusAsync(tenantId, subject, cancellationToken));
        }

        if (dbContext.ChangeTracker.HasChanges())
            await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<List<WorkforceAccountStatusDto>>.Success(statuses));
    }

    [HttpPost("bulk-provision")]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>>> BulkProvision(
        [FromBody] WorkforceAccountBulkProvisionRequest request,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure(tenantError));

        var validationError = ValidateSubjects(request.Items);
        if (validationError is not null)
            return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure(validationError));

        var results = new List<WorkforceAccountBulkProvisionResultDto>();
        foreach (var item in DistinctSubjects(request.Items))
        {
            if (!item.AccessProfileId.HasValue || item.AccessProfileId.Value == Guid.Empty)
                return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure("Access profile is required."));

            results.Add(await ProvisionInviteAsync(tenantId, item, item.AccessProfileId.Value, cancellationToken));
        }

        return Ok(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Success(results));
    }

    [HttpPost("{employeeId:guid}/invite")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> ProvisionInvite(
        Guid employeeId,
        [FromBody] ProvisionWorkforceAccountInviteRequest request,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var subject = new WorkforceAccountProvisionItemDto
        {
            EmployeeId = employeeId,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            AccessProfileId = request.AccessProfileId,
        };

        var validationError = ValidateSubject(subject);
        if (validationError is not null)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(validationError));

        if (request.AccessProfileId == Guid.Empty)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Access profile is required."));

        var result = await ProvisionInviteAsync(tenantId, subject, request.AccessProfileId, cancellationToken);
        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(result.Account));
    }

    [HttpPost("{employeeId:guid}/resend")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> ResendInvite(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var invite = await FindLatestInviteByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (invite is null)
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure("Invitation not found."));

        if (invite.IsUsed)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Cannot resend an accepted invitation."));

        if (invite.IsRevoked)
        {
            var inviteProfileIds = await ResolveInviteProfileIdsAsync(invite, cancellationToken);
            if (inviteProfileIds.Count == 0)
                return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("This invitation no longer has a valid access profile."));

            invite = await CreateInviteAsync(
                tenantId,
                new WorkforceAccountSubjectDto
                {
                    EmployeeId = employeeId,
                    Email = invite.Email,
                    FirstName = invite.FirstName,
                    LastName = invite.LastName
                },
                inviteProfileIds[0],
                cancellationToken);
        }
        else
        {
            invite.ExtendExpiry();
            await DeliverInviteAsync(invite, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(await BuildInviteStatusAsync(employeeId, invite, cancellationToken)));
    }

    [HttpPut("{employeeId:guid}/invite-profiles")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> UpdateInviteProfiles(
        Guid employeeId,
        [FromBody] SetPendingInviteAccessProfilesRequest request,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var accessProfileIds = request.AccessProfileIds
            .Where(profileId => profileId != Guid.Empty)
            .Distinct()
            .ToList();

        if (accessProfileIds.Count == 0)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("At least one access profile is required."));

        var invite = await FindLatestInviteByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (invite is null)
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure("Invitation not found."));

        if (invite.IsUsed)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Cannot change access profiles for an accepted invitation."));

        if (invite.IsRevoked)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Cannot change access profiles for a revoked invitation."));

        await accessProfileService.SetInviteAccessProfilesAsync(tenantId, invite.Id, accessProfileIds, cancellationToken);
        invite.UpdateRole(await ResolveCompatibilityRoleAsync(tenantId, accessProfileIds, cancellationToken));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(await BuildInviteStatusAsync(employeeId, invite, cancellationToken)));
    }

    [HttpPost("{employeeId:guid}/reactivate")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> Reactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var user = await FindUserByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (user is null)
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure("Account not found."));

        user.IsActive = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(await BuildUserStatusAsync(employeeId, user, cancellationToken)));
    }

    [HttpDelete("{employeeId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!CanManageWorkforceAccess())
            return Forbid();

        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse.Failure(tenantError));

        var user = await FindUserByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (user is null)
            return NotFound(ApiResponse.Failure("Account not found."));

        user.IsActive = false;
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private async Task<WorkforceAccountBulkProvisionResultDto> ProvisionInviteAsync(
        Guid tenantId,
        WorkforceAccountSubjectDto subject,
        Guid accessProfileId,
        CancellationToken cancellationToken)
    {
        var status = await ResolveStatusAsync(tenantId, subject, cancellationToken);

        switch (status.ProvisioningState)
        {
            case StateUnprovisioned:
            case StateInviteRevoked:
            {
                var invite = await CreateInviteAsync(tenantId, subject, accessProfileId, cancellationToken);
                var account = await BuildInviteStatusAsync(subject.EmployeeId, invite, cancellationToken);
                return BuildBulkResult(subject.EmployeeId, OutcomeCreated, "Invitation created.", account);
            }

            case StateInviteExpired:
            {
                var invite = await FindLatestInviteByEmployeeAsync(tenantId, subject.EmployeeId, cancellationToken);
                if (invite is null)
                {
                    invite = await CreateInviteAsync(tenantId, subject, accessProfileId, cancellationToken);
                }
                else
                {
                    invite.ExtendExpiry();
                    await accessProfileService.SetInviteAccessProfilesAsync(tenantId, invite.Id, [accessProfileId], cancellationToken);
                    invite.UpdateRole(await ResolveCompatibilityRoleAsync(tenantId, [accessProfileId], cancellationToken));
                    await DeliverInviteAsync(invite, cancellationToken);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }

                var account = await BuildInviteStatusAsync(subject.EmployeeId, invite, cancellationToken);
                return BuildBulkResult(subject.EmployeeId, OutcomeCreated, "Invitation refreshed.", account);
            }

            case StateInvitePending:
                return BuildBulkResult(subject.EmployeeId, OutcomePending, "Invitation is already pending.", status);
            case StateActive:
                return BuildBulkResult(subject.EmployeeId, OutcomeActive, "Account is already active.", status);
            case StateInactive:
                return BuildBulkResult(subject.EmployeeId, OutcomeInactive, "Account is inactive.", status);
            default:
                return BuildBulkResult(subject.EmployeeId, OutcomeConflict, status.Conflict?.Message ?? "Access conflict.", status);
        }
    }

    private async Task<WorkforceAccountStatusDto> ResolveStatusAsync(
        Guid tenantId,
        WorkforceAccountSubjectDto subject,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(subject.Email);
        var normalizedEmailUpper = normalizedEmail.ToUpperInvariant();

        var userByEmployee = await FindUserByEmployeeAsync(tenantId, subject.EmployeeId, cancellationToken);
        if (userByEmployee is not null)
        {
            if (!string.Equals(userByEmployee.NormalizedEmail, normalizedEmailUpper, StringComparison.Ordinal))
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This employee is linked to a different account email.", "Review the employee email or deactivate the linked account first.");

            return await BuildUserStatusAsync(subject.EmployeeId, userByEmployee, cancellationToken);
        }

        var userByEmail = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(user => user.TenantMemberships.Any(m => m.TenantId == tenantId && m.Status == TenantMembershipStatus.Active) && user.NormalizedEmail == normalizedEmailUpper, cancellationToken);

        if (userByEmail is not null)
        {
            if (userByEmail.EmployeeId.HasValue && userByEmail.EmployeeId.Value != subject.EmployeeId)
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This email is already linked to a different employee.", "Review duplicate employee records before inviting.");

            userByEmail.EmployeeId = subject.EmployeeId;
            return await BuildUserStatusAsync(subject.EmployeeId, userByEmail, cancellationToken);
        }

        var crossTenantUserExists = await dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(user => !user.TenantMemberships.Any(m => m.TenantId == tenantId && m.Status == TenantMembershipStatus.Active) && user.NormalizedEmail == normalizedEmailUpper, cancellationToken);
        if (crossTenantUserExists)
            return BuildConflictStatus(subject, "EmailAlreadyRegistered", "Email is already registered in another tenant.", "Use another email or contact platform support.");

        var inviteByEmployee = await FindLatestInviteByEmployeeAsync(tenantId, subject.EmployeeId, cancellationToken);
        if (inviteByEmployee is not null)
        {
            if (!string.Equals(inviteByEmployee.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase))
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This employee has an invitation for a different email.", "Revoke the old invitation before sending a new one.");

            return await BuildInviteStatusAsync(subject.EmployeeId, inviteByEmployee, cancellationToken);
        }

        var inviteByEmail = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId && invite.Email == normalizedEmail)
            .OrderByDescending(invite => invite.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (inviteByEmail is not null)
        {
            if (inviteByEmail.EmployeeId.HasValue && inviteByEmail.EmployeeId.Value != subject.EmployeeId)
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This email already has an invitation for a different employee.", "Review duplicate employee records before inviting.");

            inviteByEmail.LinkEmployee(subject.EmployeeId);
            return await BuildInviteStatusAsync(subject.EmployeeId, inviteByEmail, cancellationToken);
        }

        return BuildUnprovisionedStatus(subject);
    }

    private async Task<InviteToken> CreateInviteAsync(
        Guid tenantId,
        WorkforceAccountSubjectDto subject,
        Guid accessProfileId,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(current => current.Id == tenantId && current.IsActive && !current.IsArchived, cancellationToken);
        if (tenant is null)
            throw new InvalidOperationException("Tenant not found or inactive.");

        var selectedProfile = await accessProfileService.GetProfileAsync(tenantId, accessProfileId, cancellationToken)
            ?? throw new InvalidOperationException("Access profile not found.");

        var compatibilityRole = accessProfileService.ResolveCompatibilityRole(
            selectedProfile.Grants
                .Select(grant => new EffectivePermissionGrant(grant.PermissionKey, grant.Scope))
                .ToList());

        var currentUserId = User.GetUserId();
        var invite = InviteToken.Create(
            NormalizeEmail(subject.Email),
            tenantId,
            compatibilityRole,
            currentUserId,
            subject.FirstName,
            subject.LastName,
            subject.EmployeeId);

        dbContext.InviteTokens.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);
        await accessProfileService.SetInviteAccessProfilesAsync(tenantId, invite.Id, [selectedProfile.Id], cancellationToken);
        await DeliverInviteAsync(invite, tenant.Name, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return invite;
    }

    private async Task<ApplicationUser?> FindUserByEmployeeAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken)
        => await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(user => user.TenantMemberships.Any(m => m.TenantId == tenantId && m.Status == TenantMembershipStatus.Active) && user.EmployeeId == employeeId, cancellationToken);

    private async Task<InviteToken?> FindLatestInviteByEmployeeAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken)
        => await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId && invite.EmployeeId == employeeId)
            .OrderByDescending(invite => invite.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<InviteToken?> FindLatestInviteAsync(
        Guid tenantId,
        WorkforceAccountSubjectDto subject,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(subject.Email);
        return await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId && (invite.EmployeeId == subject.EmployeeId || invite.Email == normalizedEmail))
            .OrderByDescending(invite => invite.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<WorkforceAccountStatusDto> BuildUserStatusAsync(Guid employeeId, ApplicationUser user, CancellationToken cancellationToken)
    {
        var accessProfiles = (await accessProfileService.GetAssignedProfilesAsync(user, cancellationToken)).ToList();
        var effectivePermissions = await accessProfileService.GetEffectivePermissionsAsync(user, cancellationToken);
        return new WorkforceAccountStatusDto
        {
            EmployeeId = employeeId,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            Role = accessProfileService.ResolveCompatibilityRole(effectivePermissions),
            AccessProfiles = accessProfiles,
            ProvisioningState = user.IsActive ? StateActive : StateInactive,
            UserId = user.Id,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt
        };
    }

    private async Task<WorkforceAccountStatusDto> BuildInviteStatusAsync(Guid employeeId, InviteToken invite, CancellationToken cancellationToken)
    {
        var state = invite.IsRevoked
            ? StateInviteRevoked
            : invite.IsUsed
                ? StateInviteAccepted
                : invite.IsExpired
                    ? StateInviteExpired
                    : StateInvitePending;
        var linkable = state == StateInvitePending;

        var accessProfiles = (await accessProfileService.GetInviteAccessProfilesAsync(invite.Id, cancellationToken)).ToList();

        return new WorkforceAccountStatusDto
        {
            EmployeeId = employeeId,
            Email = invite.Email,
            FullName = BuildFullName(invite.FirstName, invite.LastName),
            Role = invite.Role,
            AccessProfiles = accessProfiles,
            ProvisioningState = state,
            InviteId = invite.Id,
            InviteCreatedAt = invite.CreatedAt,
            InviteExpiresAt = invite.ExpiresAt,
            InviteLink = linkable ? BuildInviteLink(invite.Token) : null,
            DeliveryStatus = invite.DeliveryStatus,
            DeliveryMessage = invite.DeliveryMessage,
            DeliveryRecordedAt = invite.DeliveryRecordedAt
        };
    }

    private static WorkforceAccountStatusDto BuildUnprovisionedStatus(WorkforceAccountSubjectDto subject)
        => new()
        {
            EmployeeId = subject.EmployeeId,
            Email = NormalizeEmail(subject.Email),
            FullName = BuildFullName(subject.FirstName, subject.LastName),
            Role = PlatformRole.Employee,
            AccessProfiles = [],
            ProvisioningState = StateUnprovisioned
        };

    private static WorkforceAccountStatusDto BuildConflictStatus(
        WorkforceAccountSubjectDto subject,
        string kind,
        string message,
        string suggestedAction)
        => new()
        {
            EmployeeId = subject.EmployeeId,
            Email = NormalizeEmail(subject.Email),
            FullName = BuildFullName(subject.FirstName, subject.LastName),
            Role = PlatformRole.Employee,
            AccessProfiles = [],
            ProvisioningState = StateConflict,
            Conflict = new WorkforceAccountConflictDto
            {
                Kind = kind,
                Message = message,
                Blocking = true,
                SuggestedAction = suggestedAction
            }
        };

    private static WorkforceAccountBulkProvisionResultDto BuildBulkResult(
        Guid employeeId,
        string outcome,
        string message,
        WorkforceAccountStatusDto account)
        => new()
        {
            EmployeeId = employeeId,
            Outcome = outcome,
            Message = message,
            Account = account
        };

    private string BuildInviteLink(string token)
        => InvitationLinkBuilder.Build(configuration, token);

    private async Task DeliverInviteAsync(
        InviteToken invite,
        CancellationToken cancellationToken)
    {
        var tenantName = await dbContext.Tenants
            .IgnoreQueryFilters()
            .Where(tenant => tenant.Id == invite.TenantId)
            .Select(tenant => tenant.Name)
            .FirstOrDefaultAsync(cancellationToken)
            ?? "your organization";

        await DeliverInviteAsync(invite, tenantName, cancellationToken);
    }

    private async Task DeliverInviteAsync(
        InviteToken invite,
        string tenantName,
        CancellationToken cancellationToken)
    {
        var accessProfiles = await accessProfileService.GetInviteAccessProfilesAsync(invite.Id, cancellationToken);
        var delivery = await workforceInvitationEmailSender.SendInviteAsync(
            new WorkforceInvitationEmailMessage(
                invite.Id,
                invite.TenantId,
                tenantName,
                invite.EmployeeId,
                invite.Email,
                BuildFullName(invite.FirstName, invite.LastName),
                BuildInviteLink(invite.Token),
                invite.ExpiresAt,
                accessProfiles.Select(profile => profile.Name).ToList()),
            cancellationToken);

        invite.RecordDelivery(delivery.Status, delivery.Message, delivery.RecordedAt);
    }

    private bool CanViewWorkforceAccess()
        => (User.IsInRole(PlatformRole.PlatformAdmin) && tenantContext.IsResolved)
            || User.HasCorePermission(CorePermissions.AccessView, PermissionScopes.Tenant)
            || User.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant)
            || User.HasCorePermission(CorePermissions.AccessAssignmentsView, PermissionScopes.Tenant)
            || User.HasCorePermission(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant);

    private bool CanManageWorkforceAccess()
        => User.HasCorePermission(CorePermissions.AccessManage, PermissionScopes.Tenant)
            || User.HasCorePermission(CorePermissions.AccessAssignmentsManage, PermissionScopes.Tenant);

    private bool TryGetTenantId(out Guid tenantId, out string error)
    {
        var resolvedTenantId = tenantContext.TenantIdOrDefault ?? User.GetTenantId();
        if (!resolvedTenantId.HasValue || resolvedTenantId.Value == Guid.Empty)
        {
            tenantId = Guid.Empty;
            error = "Tenant context required.";
            return false;
        }

        tenantId = resolvedTenantId.Value;
        error = string.Empty;
        return true;
    }

    private static string? ValidateSubjects<TSubject>(IEnumerable<TSubject>? subjects)
        where TSubject : WorkforceAccountSubjectDto
    {
        if (subjects is null)
            return "At least one workforce account subject is required.";

        foreach (var subject in subjects)
        {
            var error = ValidateSubject(subject);
            if (error is not null)
                return error;
        }

        return null;
    }

    private static string? ValidateSubject(WorkforceAccountSubjectDto subject)
    {
        if (subject.EmployeeId == Guid.Empty)
            return "Employee ID is required.";

        if (string.IsNullOrWhiteSpace(subject.Email))
            return "Email is required.";

        return null;
    }

    private static IEnumerable<TSubject> DistinctSubjects<TSubject>(IEnumerable<TSubject> subjects)
        where TSubject : WorkforceAccountSubjectDto
        => subjects
            .GroupBy(subject => subject.EmployeeId)
            .Select(group => group.Last());

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

    private async Task<List<Guid>> ResolveInviteProfileIdsAsync(InviteToken invite, CancellationToken cancellationToken)
        => await dbContext.InviteAccessProfiles
            .IgnoreQueryFilters()
            .Where(assignment => assignment.InviteTokenId == invite.Id)
            .Select(assignment => assignment.AccessProfileId)
            .ToListAsync(cancellationToken);

    private async Task<string> ResolveCompatibilityRoleAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> accessProfileIds,
        CancellationToken cancellationToken)
    {
        var profiles = new List<AccessProfileSummaryDto>();
        foreach (var accessProfileId in accessProfileIds)
        {
            var profile = await accessProfileService.GetProfileAsync(tenantId, accessProfileId, cancellationToken)
                ?? throw new InvalidOperationException("Access profile not found.");
            profiles.Add(profile);
        }

        return accessProfileService.ResolveCompatibilityRole(
            profiles
                .SelectMany(profile => profile.Grants)
                .Select(grant => new EffectivePermissionGrant(grant.PermissionKey, grant.Scope))
                .ToList());
    }

    private static string? BuildFullName(string? firstName, string? lastName)
    {
        var fullName = $"{firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? null : fullName;
    }
}
