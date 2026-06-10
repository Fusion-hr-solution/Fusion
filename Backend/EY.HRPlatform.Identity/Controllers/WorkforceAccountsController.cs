using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/workforce-accounts")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public sealed class WorkforceAccountsController(
    AppIdentityDbContext dbContext,
    IInvitationLinkBuilder invitationLinkBuilder,
    IWorkforceInvitationEmailSender invitationEmailSender) : ControllerBase
{
    [HttpGet("{employeeId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> GetStatus(
        Guid employeeId,
        [FromQuery] string? email,
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "Tenant context is required to inspect workforce account status."));
        }

        var snapshot = new WorkforceAccountSnapshot(employeeId, email, firstName, lastName);
        var dto = await BuildStatusDtoAsync(snapshot, tenantId.Value, cancellationToken);
        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(dto));
    }

    [HttpPost("statuses")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceAccountStatusDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceAccountStatusDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<WorkforceAccountStatusDto>>>> GetStatuses(
        [FromBody] ResolveWorkforceAccountStatusesRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<IReadOnlyList<WorkforceAccountStatusDto>>.Failure(
                "Tenant context is required to inspect workforce account status."));
        }

        var snapshots = request.Employees
            .Select(ToSnapshot)
            .ToArray();

        var statuses = await BuildStatusesAsync(snapshots, tenantId.Value, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WorkforceAccountStatusDto>>.Success(statuses));
    }

    [HttpPost("{employeeId:guid}/invite")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> CreateInvite(
        Guid employeeId,
        [FromBody] ProvisionWorkforceAccountInviteRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "Tenant context is required to provision a workforce account."));
        }

        if (!PlatformRole.All.Contains(request.Role))
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure($"Invalid role: {request.Role}"));
        }

        if (!CanProvisionRole(request.Role))
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                ApiResponse<WorkforceAccountStatusDto>.Failure(
                    "You do not have permission to provision this role from Core."));
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Email is required."));
        }

        var snapshot = new WorkforceAccountSnapshot(employeeId, normalizedEmail, request.FirstName, request.LastName);
        var currentStatus = await BuildStatusDtoAsync(snapshot, tenantId.Value, cancellationToken);
        if (TryGetProvisioningBlockedMessage(currentStatus, out var blockedMessage))
        {
            return Conflict(ApiResponse<WorkforceAccountStatusDto>.Failure(blockedMessage));
        }

        var invite = InviteToken.Create(
            email: normalizedEmail,
            tenantId: tenantId.Value,
            role: request.Role,
            createdByUserId: User.GetUserId(),
            firstName: request.FirstName,
            lastName: request.LastName,
            employeeId: employeeId);

        dbContext.InviteTokens.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);

        var deliveryResult = await SendInvitationAsync(invite, request.FirstName, request.LastName, cancellationToken);
        var dto = CreateStatusDto(snapshot, linkedUser: null, latestInvite: invite, role: invite.Role, deliveryResult, conflict: null);

        return CreatedAtAction(nameof(GetStatus), new { employeeId }, ApiResponse<WorkforceAccountStatusDto>.Success(dto));
    }

    [HttpPost("invite/bulk")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<WorkforceAccountBulkProvisionResultDto>>>> BulkCreateInvites(
        [FromBody] BulkProvisionWorkforceAccountInvitesRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<IReadOnlyList<WorkforceAccountBulkProvisionResultDto>>.Failure(
                "Tenant context is required to provision workforce accounts."));
        }

        var results = new List<WorkforceAccountBulkProvisionResultDto>(request.Items.Count);
        foreach (var item in request.Items)
        {
            var normalizedEmail = NormalizeEmail(item.Email);
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                results.Add(new WorkforceAccountBulkProvisionResultDto
                {
                    EmployeeId = item.EmployeeId,
                    Outcome = WorkforceAccountBulkProvisionOutcomes.Conflict,
                    Message = "Email is required.",
                });
                continue;
            }

            var snapshot = new WorkforceAccountSnapshot(item.EmployeeId, normalizedEmail, item.FirstName, item.LastName);
            var currentStatus = await BuildStatusDtoAsync(snapshot, tenantId.Value, cancellationToken);

            if (!PlatformRole.All.Contains(item.Role))
            {
                results.Add(new WorkforceAccountBulkProvisionResultDto
                {
                    EmployeeId = item.EmployeeId,
                    Outcome = WorkforceAccountBulkProvisionOutcomes.Conflict,
                    Message = $"Invalid role: {item.Role}",
                    Account = currentStatus,
                });
                continue;
            }

            if (!CanProvisionRole(item.Role))
            {
                results.Add(new WorkforceAccountBulkProvisionResultDto
                {
                    EmployeeId = item.EmployeeId,
                    Outcome = WorkforceAccountBulkProvisionOutcomes.Conflict,
                    Message = "You do not have permission to provision this role from Core.",
                    Account = currentStatus,
                });
                continue;
            }

            if (TryGetProvisioningBlockedMessage(currentStatus, out var blockedMessage))
            {
                results.Add(new WorkforceAccountBulkProvisionResultDto
                {
                    EmployeeId = item.EmployeeId,
                    Outcome = GetOutcome(currentStatus),
                    Message = blockedMessage,
                    Account = currentStatus,
                });
                continue;
            }

            var invite = InviteToken.Create(
                email: normalizedEmail,
                tenantId: tenantId.Value,
                role: item.Role,
                createdByUserId: User.GetUserId(),
                firstName: item.FirstName,
                lastName: item.LastName,
                employeeId: item.EmployeeId);

            dbContext.InviteTokens.Add(invite);
            await dbContext.SaveChangesAsync(cancellationToken);

            var deliveryResult = await SendInvitationAsync(invite, item.FirstName, item.LastName, cancellationToken);
            results.Add(new WorkforceAccountBulkProvisionResultDto
            {
                EmployeeId = item.EmployeeId,
                Outcome = WorkforceAccountBulkProvisionOutcomes.Created,
                Message = "Workforce invitation created.",
                Account = CreateStatusDto(snapshot, linkedUser: null, latestInvite: invite, role: invite.Role, deliveryResult, conflict: null),
            });
        }

        return Ok(ApiResponse<IReadOnlyList<WorkforceAccountBulkProvisionResultDto>>.Success(results));
    }

    [HttpPost("{employeeId:guid}/invite/resend")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> ResendInvite(
        Guid employeeId,
        [FromQuery] string? email,
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "Tenant context is required to resend a workforce invitation."));
        }

        var snapshot = new WorkforceAccountSnapshot(employeeId, email, firstName, lastName);
        var resolution = await ResolveStatusDataAsync([snapshot], tenantId.Value, cancellationToken);
        var currentStatus = resolution.Statuses[employeeId];
        var linkedUser = resolution.LinkedUsersByEmployeeId.GetValueOrDefault(employeeId);
        var invite = resolution.LatestInvitesByEmployeeId.GetValueOrDefault(employeeId);

        if (linkedUser is not null)
        {
            var message = linkedUser.IsActive
                ? "An active platform account is already linked to this employee."
                : "An inactive platform account is already linked to this employee.";

            return Conflict(ApiResponse<WorkforceAccountStatusDto>.Failure(message));
        }

        if (invite is null)
        {
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "No workforce invitation exists for this employee."));
        }

        if (invite.IsUsed)
        {
            return Conflict(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "This invitation has already been accepted."));
        }

        if (invite.IsRevoked)
        {
            return Conflict(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "This invitation has been revoked and cannot be resent."));
        }

        if (currentStatus.Conflict?.Blocking == true)
        {
            return Conflict(ApiResponse<WorkforceAccountStatusDto>.Failure(currentStatus.Conflict.Message));
        }

        invite.ExtendExpiry();
        await dbContext.SaveChangesAsync(cancellationToken);

        var deliveryResult = await SendInvitationAsync(invite, invite.FirstName, invite.LastName, cancellationToken);
        var dto = CreateStatusDto(
            new WorkforceAccountSnapshot(employeeId, invite.Email, invite.FirstName, invite.LastName),
            linkedUser: null,
            latestInvite: invite,
            role: invite.Role,
            deliveryResult,
            conflict: null);

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(dto));
    }

    [HttpPost("{employeeId:guid}/deactivate")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> Deactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        return await SetLinkedUserActiveState(employeeId, isActive: false, cancellationToken);
    }

    [HttpPost("{employeeId:guid}/reactivate")]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> Reactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        return await SetLinkedUserActiveState(employeeId, isActive: true, cancellationToken);
    }

    private Guid? GetEffectiveTenantId()
    {
        if (User.IsInRole(PlatformRole.PlatformAdmin)
            && Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue)
            && Guid.TryParse(headerValue.FirstOrDefault(), out var platformTenantId)
            && platformTenantId != Guid.Empty)
        {
            return platformTenantId;
        }

        return User.GetTenantId();
    }

    private async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> SetLinkedUserActiveState(
        Guid employeeId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        var tenantId = GetEffectiveTenantId();
        if (!tenantId.HasValue)
        {
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "Tenant context is required to manage workforce accounts."));
        }

        var linkedUser = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                user => user.TenantId == tenantId.Value && user.EmployeeId == employeeId,
                cancellationToken);

        if (linkedUser is null)
        {
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure(
                "No linked platform account exists for this employee."));
        }

        linkedUser.IsActive = isActive;
        await dbContext.SaveChangesAsync(cancellationToken);

        var latestInvite = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId.Value && invite.EmployeeId == employeeId)
            .OrderByDescending(invite => invite.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var role = await GetPrimaryRoleAsync(linkedUser.Id, cancellationToken);
        var dto = CreateStatusDto(
            new WorkforceAccountSnapshot(employeeId, linkedUser.Email, linkedUser.FirstName, linkedUser.LastName),
            linkedUser,
            latestInvite,
            role,
            deliveryResult: null,
            conflict: null);

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(dto));
    }

    private async Task<WorkforceAccountStatusDto> BuildStatusDtoAsync(
        WorkforceAccountSnapshot snapshot,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var statuses = await BuildStatusesAsync([snapshot], tenantId, cancellationToken);
        return statuses[0];
    }

    private async Task<IReadOnlyList<WorkforceAccountStatusDto>> BuildStatusesAsync(
        IReadOnlyCollection<WorkforceAccountSnapshot> snapshots,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var resolution = await ResolveStatusDataAsync(snapshots, tenantId, cancellationToken);
        return snapshots
            .Select(snapshot => resolution.Statuses[snapshot.EmployeeId])
            .ToArray();
    }

    private async Task<ResolvedWorkforceAccountData> ResolveStatusDataAsync(
        IReadOnlyCollection<WorkforceAccountSnapshot> snapshots,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var employeeIds = snapshots
            .Select(snapshot => snapshot.EmployeeId)
            .Distinct()
            .ToArray();
        var normalizedEmails = snapshots
            .Select(snapshot => NormalizeEmail(snapshot.Email))
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var normalizedUserEmails = normalizedEmails
            .Select(ToNormalizedUserEmail)
            .ToArray();

        var linkedUsers = await dbContext.Users
            .IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId
                && user.EmployeeId.HasValue
                && employeeIds.Contains(user.EmployeeId.Value))
            .ToListAsync(cancellationToken);

        var latestInvites = await dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Where(invite => invite.TenantId == tenantId
                && invite.EmployeeId.HasValue
                && employeeIds.Contains(invite.EmployeeId.Value))
            .OrderByDescending(invite => invite.CreatedAt)
            .ToListAsync(cancellationToken);

        var emailUsers = normalizedEmails.Length == 0
            ? new List<ApplicationUser>()
            : await dbContext.Users
                .IgnoreQueryFilters()
                .Where(user => user.NormalizedEmail != null
                    && normalizedUserEmails.Contains(user.NormalizedEmail))
                .ToListAsync(cancellationToken);

        var pendingEmailInvites = normalizedEmails.Length == 0
            ? new List<InviteToken>()
            : await dbContext.InviteTokens
                .IgnoreQueryFilters()
                .Where(invite => invite.TenantId == tenantId
                    && normalizedEmails.Contains(invite.Email)
                    && invite.AcceptedAt == null
                    && !invite.IsRevoked
                    && invite.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(invite => invite.CreatedAt)
                .ToListAsync(cancellationToken);

        var linkedUserIds = linkedUsers.Select(user => user.Id).ToArray();
        var linkedUserRoles = linkedUserIds.Length == 0
            ? new List<UserRoleLookup>()
            : await dbContext.UserRoles
                .AsNoTracking()
                .Where(userRole => linkedUserIds.Contains(userRole.UserId))
                .Join(
                    dbContext.Roles.AsNoTracking(),
                    userRole => userRole.RoleId,
                    role => role.Id,
                    (userRole, role) => new UserRoleLookup(userRole.UserId, role.Name ?? string.Empty))
                .ToListAsync(cancellationToken);

        var rolesByUserId = linkedUserRoles
            .GroupBy(entry => entry.UserId)
            .ToDictionary(group => group.Key, group => group.Select(entry => entry.Role).FirstOrDefault() ?? string.Empty);

        var linkedUsersByEmployeeId = linkedUsers
            .Where(user => user.EmployeeId.HasValue)
            .ToDictionary(user => user.EmployeeId!.Value);

        var latestInvitesByEmployeeId = latestInvites
            .GroupBy(invite => invite.EmployeeId!.Value)
            .ToDictionary(group => group.Key, group => group.First());

        var emailUsersByNormalizedEmail = emailUsers
            .Where(user => !string.IsNullOrWhiteSpace(user.NormalizedEmail))
            .GroupBy(user => user.NormalizedEmail!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var pendingInvitesByEmail = pendingEmailInvites
            .GroupBy(invite => invite.Email, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var statuses = snapshots.ToDictionary(
            snapshot => snapshot.EmployeeId,
            snapshot =>
            {
                var linkedUser = linkedUsersByEmployeeId.GetValueOrDefault(snapshot.EmployeeId);
                var latestInvite = latestInvitesByEmployeeId.GetValueOrDefault(snapshot.EmployeeId);
                var normalizedEmail = NormalizeEmail(snapshot.Email);
                var emailMatchedUser = normalizedEmail is null
                    ? null
                    : emailUsersByNormalizedEmail.GetValueOrDefault(ToNormalizedUserEmail(normalizedEmail));
                var pendingInviteByEmail = normalizedEmail is null
                    ? null
                    : pendingInvitesByEmail.GetValueOrDefault(normalizedEmail);
                var role = linkedUser is not null && rolesByUserId.TryGetValue(linkedUser.Id, out var linkedRole)
                    ? linkedRole
                    : latestInvite?.Role ?? string.Empty;
                var conflict = ResolveConflict(snapshot, linkedUser, latestInvite, emailMatchedUser, pendingInviteByEmail);

                return CreateStatusDto(snapshot, linkedUser, latestInvite, role, deliveryResult: null, conflict);
            });

        return new ResolvedWorkforceAccountData(statuses, linkedUsersByEmployeeId, latestInvitesByEmployeeId);
    }

    private WorkforceAccountStatusDto CreateStatusDto(
        WorkforceAccountSnapshot snapshot,
        ApplicationUser? linkedUser,
        InviteToken? latestInvite,
        string role,
        WorkforceInvitationEmailDeliveryResult? deliveryResult,
        WorkforceAccountConflictDto? conflict)
    {
        var inviteLink = latestInvite is not null && !latestInvite.IsUsed
            ? invitationLinkBuilder.BuildInviteLink(latestInvite.Token)
            : null;

        return new WorkforceAccountStatusDto
        {
            EmployeeId = snapshot.EmployeeId,
            Email = linkedUser?.Email ?? latestInvite?.Email ?? snapshot.Email ?? string.Empty,
            FullName = linkedUser?.FullName ?? ResolveFullName(snapshot, latestInvite),
            Role = role,
            ProvisioningState = ResolveProvisioningState(linkedUser, latestInvite, conflict),
            UserId = linkedUser?.Id,
            IsActive = linkedUser?.IsActive,
            LastLoginAt = linkedUser?.LastLoginAt,
            InviteId = latestInvite?.Id,
            InviteCreatedAt = latestInvite?.CreatedAt,
            InviteExpiresAt = latestInvite?.ExpiresAt,
            InviteLink = inviteLink,
            DeliveryStatus = deliveryResult?.Status ?? latestInvite?.DeliveryStatus,
            DeliveryMessage = deliveryResult?.Message ?? latestInvite?.DeliveryMessage,
            DeliveryRecordedAt = deliveryResult is not null
                ? latestInvite?.DeliveryRecordedAt ?? DateTime.UtcNow
                : latestInvite?.DeliveryRecordedAt,
            Conflict = conflict,
        };
    }

    private async Task<WorkforceInvitationEmailDeliveryResult> SendInvitationAsync(
        InviteToken invite,
        string? firstName,
        string? lastName,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(currentTenant => currentTenant.Id == invite.TenantId, cancellationToken);

        var message = new WorkforceInvitationEmailMessage(
            invite.Id,
            invite.Email,
            invitationLinkBuilder.BuildInviteLink(invite.Token),
            tenant?.Name ?? "Fusion",
            invite.Role,
            firstName,
            lastName);

        var deliveryResult = await invitationEmailSender.SendInvitationAsync(message, cancellationToken);
        invite.RecordDeliveryAttempt(deliveryResult.Status, deliveryResult.Message);
        await dbContext.SaveChangesAsync(cancellationToken);

        return deliveryResult;
    }

    private async Task<string> GetPrimaryRoleAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await dbContext.UserRoles
            .AsNoTracking()
            .Where(userRole => userRole.UserId == userId)
            .Join(
                dbContext.Roles.AsNoTracking(),
                userRole => userRole.RoleId,
                role => role.Id,
                (_, role) => role.Name)
            .FirstOrDefaultAsync(cancellationToken)
            ?? string.Empty;
    }

    private bool CanProvisionRole(string role)
    {
        return User.IsInRole(PlatformRole.PlatformAdmin)
            || role is PlatformRole.Employee or PlatformRole.Manager;
    }

    private static bool TryGetProvisioningBlockedMessage(
        WorkforceAccountStatusDto status,
        out string blockedMessage)
    {
        if (status.Conflict?.Blocking == true)
        {
            blockedMessage = status.Conflict.Message;
            return true;
        }

        blockedMessage = status.ProvisioningState switch
        {
            WorkforceAccountProvisioningStates.Active => "An active platform account is already linked to this employee.",
            WorkforceAccountProvisioningStates.Inactive => "An inactive platform account is already linked to this employee.",
            WorkforceAccountProvisioningStates.InvitePending => "A pending workforce invitation already exists for this employee or email.",
            WorkforceAccountProvisioningStates.InviteAccepted => "This invitation has already been accepted.",
            _ => string.Empty,
        };

        return !string.IsNullOrWhiteSpace(blockedMessage);
    }

    private static string GetOutcome(WorkforceAccountStatusDto status)
    {
        return status.ProvisioningState switch
        {
            WorkforceAccountProvisioningStates.Active => WorkforceAccountBulkProvisionOutcomes.Active,
            WorkforceAccountProvisioningStates.Inactive => WorkforceAccountBulkProvisionOutcomes.Inactive,
            WorkforceAccountProvisioningStates.InvitePending => WorkforceAccountBulkProvisionOutcomes.Pending,
            _ when status.Conflict?.Blocking == true => WorkforceAccountBulkProvisionOutcomes.Conflict,
            _ => WorkforceAccountBulkProvisionOutcomes.Conflict,
        };
    }

    private static WorkforceAccountConflictDto? ResolveConflict(
        WorkforceAccountSnapshot snapshot,
        ApplicationUser? linkedUser,
        InviteToken? latestInvite,
        ApplicationUser? emailMatchedUser,
        InviteToken? pendingInviteByEmail)
    {
        var normalizedEmployeeEmail = NormalizeEmail(snapshot.Email);
        if (string.IsNullOrWhiteSpace(normalizedEmployeeEmail))
        {
            return null;
        }

        if (linkedUser is not null && !EmailsMatch(linkedUser.Email, normalizedEmployeeEmail))
        {
            return new WorkforceAccountConflictDto
            {
                Kind = WorkforceAccountConflictKinds.EmployeeEmailMismatch,
                Message = "Employee work email differs from the linked platform account email.",
                Blocking = false,
                SuggestedAction = "Review the employee email before reprovisioning or resending access.",
            };
        }

        if (linkedUser is null
            && emailMatchedUser is not null
            && emailMatchedUser.EmployeeId != snapshot.EmployeeId)
        {
            return new WorkforceAccountConflictDto
            {
                Kind = WorkforceAccountConflictKinds.EmailAlreadyRegistered,
                Message = "This work email is already registered to a different platform account.",
                Blocking = true,
                SuggestedAction = "Resolve the existing account before provisioning access for this employee.",
            };
        }

        if (linkedUser is null
            && pendingInviteByEmail is not null
            && pendingInviteByEmail.EmployeeId != snapshot.EmployeeId)
        {
            return new WorkforceAccountConflictDto
            {
                Kind = WorkforceAccountConflictKinds.PendingInviteExists,
                Message = "A pending invitation already exists for this work email.",
                Blocking = true,
                SuggestedAction = "Use the existing invitation or wait until it is resolved before provisioning another account.",
            };
        }

        if (latestInvite is not null
            && !latestInvite.IsUsed
            && !latestInvite.IsRevoked
            && !latestInvite.IsExpired
            && !EmailsMatch(latestInvite.Email, normalizedEmployeeEmail))
        {
            return new WorkforceAccountConflictDto
            {
                Kind = WorkforceAccountConflictKinds.EmployeeEmailMismatch,
                Message = "A pending invitation exists for a different email than the employee record.",
                Blocking = true,
                SuggestedAction = "Resolve the email mismatch before resending or provisioning a new invitation.",
            };
        }

        return null;
    }

    private static string? ResolveFullName(WorkforceAccountSnapshot snapshot, InviteToken? invite)
    {
        var snapshotFullName = string.Join(
            " ",
            new[] { snapshot.FirstName, snapshot.LastName }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim()));

        if (!string.IsNullOrWhiteSpace(snapshotFullName))
        {
            return snapshotFullName;
        }

        return ResolveInviteFullName(invite);
    }

    private static string? ResolveInviteFullName(InviteToken? invite)
    {
        if (invite is null)
        {
            return null;
        }

        var fullName = string.Join(
            " ",
            new[] { invite.FirstName, invite.LastName }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim()));

        return string.IsNullOrWhiteSpace(fullName) ? null : fullName;
    }

    private static string ResolveProvisioningState(
        ApplicationUser? linkedUser,
        InviteToken? latestInvite,
        WorkforceAccountConflictDto? conflict)
    {
        if (linkedUser is not null)
        {
            return linkedUser.IsActive
                ? WorkforceAccountProvisioningStates.Active
                : WorkforceAccountProvisioningStates.Inactive;
        }

        if (latestInvite is null)
        {
            return conflict?.Blocking == true
                ? WorkforceAccountProvisioningStates.Conflict
                : WorkforceAccountProvisioningStates.Unprovisioned;
        }

        if (latestInvite.IsUsed)
        {
            return WorkforceAccountProvisioningStates.InviteAccepted;
        }

        if (latestInvite.IsRevoked)
        {
            return WorkforceAccountProvisioningStates.InviteRevoked;
        }

        if (latestInvite.IsExpired)
        {
            return WorkforceAccountProvisioningStates.InviteExpired;
        }

        return WorkforceAccountProvisioningStates.InvitePending;
    }

    private static WorkforceAccountSnapshot ToSnapshot(WorkforceAccountEmployeeSnapshotRequest request)
        => new(request.EmployeeId, request.Email, request.FirstName, request.LastName);

    private static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        return email.Trim().ToLowerInvariant();
    }

    private static string ToNormalizedUserEmail(string email)
        => email.Trim().ToUpperInvariant();

    private static bool EmailsMatch(string? left, string? right)
        => string.Equals(NormalizeEmail(left), NormalizeEmail(right), StringComparison.OrdinalIgnoreCase);

    private sealed record WorkforceAccountSnapshot(
        Guid EmployeeId,
        string? Email,
        string? FirstName,
        string? LastName);

    private sealed record UserRoleLookup(Guid UserId, string Role);

    private sealed record ResolvedWorkforceAccountData(
        IReadOnlyDictionary<Guid, WorkforceAccountStatusDto> Statuses,
        IReadOnlyDictionary<Guid, ApplicationUser> LinkedUsersByEmployeeId,
        IReadOnlyDictionary<Guid, InviteToken> LatestInvitesByEmployeeId);
}
