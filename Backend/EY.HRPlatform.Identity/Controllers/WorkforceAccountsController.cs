using EY.HRPlatform.Identity.Domain.Entities;
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
    UserManager<ApplicationUser> userManager,
    ITenantContext tenantContext,
    IConfiguration configuration) : ControllerBase
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

    [HttpPost("statuses")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountStatusDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountStatusDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<List<WorkforceAccountStatusDto>>>> GetStatuses(
        [FromBody] WorkforceAccountStatusesRequest request,
        CancellationToken cancellationToken)
    {
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
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>>> BulkProvision(
        [FromBody] WorkforceAccountBulkProvisionRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure(tenantError));

        var validationError = ValidateSubjects(request.Items);
        if (validationError is not null)
            return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure(validationError));

        var results = new List<WorkforceAccountBulkProvisionResultDto>();
        foreach (var item in DistinctSubjects(request.Items))
        {
            var role = NormalizeWorkforceRole(item.Role);
            if (role is null)
                return BadRequest(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Failure("Role must be Employee or Manager."));

            results.Add(await ProvisionInviteAsync(tenantId, item, role, cancellationToken));
        }

        return Ok(ApiResponse<List<WorkforceAccountBulkProvisionResultDto>>.Success(results));
    }

    [HttpPost("{employeeId:guid}/invite")]
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> ProvisionInvite(
        Guid employeeId,
        [FromBody] ProvisionWorkforceAccountInviteRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var subject = new WorkforceAccountProvisionItemDto
        {
            EmployeeId = employeeId,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Role = request.Role
        };

        var validationError = ValidateSubject(subject);
        if (validationError is not null)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(validationError));

        var role = NormalizeWorkforceRole(request.Role);
        if (role is null)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Role must be Employee or Manager."));

        var result = await ProvisionInviteAsync(tenantId, subject, role, cancellationToken);
        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(result.Account));
    }

    [HttpPost("{employeeId:guid}/resend")]
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> ResendInvite(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var invite = await FindLatestInviteByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (invite is null)
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure("Invitation not found."));

        if (invite.IsUsed)
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure("Cannot resend an accepted invitation."));

        if (invite.IsRevoked)
        {
            invite = await CreateInviteAsync(
                tenantId,
                new WorkforceAccountSubjectDto
                {
                    EmployeeId = employeeId,
                    Email = invite.Email,
                    FirstName = invite.FirstName,
                    LastName = invite.LastName
                },
                invite.Role,
                cancellationToken);
        }
        else
        {
            invite.ExtendExpiry();
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(BuildInviteStatus(employeeId, invite)));
    }

    [HttpPost("{employeeId:guid}/reactivate")]
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<WorkforceAccountStatusDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<WorkforceAccountStatusDto>>> Reactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var tenantError))
            return BadRequest(ApiResponse<WorkforceAccountStatusDto>.Failure(tenantError));

        var user = await FindUserByEmployeeAsync(tenantId, employeeId, cancellationToken);
        if (user is null)
            return NotFound(ApiResponse<WorkforceAccountStatusDto>.Failure("Account not found."));

        user.IsActive = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<WorkforceAccountStatusDto>.Success(await BuildUserStatusAsync(employeeId, user)));
    }

    [HttpDelete("{employeeId:guid}")]
    [Authorize(Roles = PlatformRole.HRAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deactivate(
        Guid employeeId,
        CancellationToken cancellationToken)
    {
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
        string role,
        CancellationToken cancellationToken)
    {
        var status = await ResolveStatusAsync(tenantId, subject, cancellationToken);

        switch (status.ProvisioningState)
        {
            case StateUnprovisioned:
            case StateInviteRevoked:
            {
                var invite = await CreateInviteAsync(tenantId, subject, role, cancellationToken);
                var account = BuildInviteStatus(subject.EmployeeId, invite);
                return BuildBulkResult(subject.EmployeeId, OutcomeCreated, "Invitation created.", account);
            }

            case StateInviteExpired:
            {
                var invite = await FindLatestInviteAsync(tenantId, subject, cancellationToken)
                    ?? await CreateInviteAsync(tenantId, subject, role, cancellationToken);
                if (!invite.IsRevoked && !invite.IsUsed)
                {
                    invite.ExtendExpiry();
                    invite.LinkEmployee(subject.EmployeeId);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }

                var account = BuildInviteStatus(subject.EmployeeId, invite);
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

            return await BuildUserStatusAsync(subject.EmployeeId, userByEmployee);
        }

        var userByEmail = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(user => user.TenantId == tenantId && user.NormalizedEmail == normalizedEmailUpper, cancellationToken);

        if (userByEmail is not null)
        {
            if (userByEmail.EmployeeId.HasValue && userByEmail.EmployeeId.Value != subject.EmployeeId)
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This email is already linked to a different employee.", "Review duplicate employee records before inviting.");

            userByEmail.EmployeeId = subject.EmployeeId;
            return await BuildUserStatusAsync(subject.EmployeeId, userByEmail);
        }

        var crossTenantUserExists = await dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(user => user.TenantId != tenantId && user.NormalizedEmail == normalizedEmailUpper, cancellationToken);
        if (crossTenantUserExists)
            return BuildConflictStatus(subject, "EmailAlreadyRegistered", "Email is already registered in another tenant.", "Use another email or contact platform support.");

        var inviteByEmployee = await FindLatestInviteByEmployeeAsync(tenantId, subject.EmployeeId, cancellationToken);
        if (inviteByEmployee is not null)
        {
            if (!string.Equals(inviteByEmployee.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase))
                return BuildConflictStatus(subject, "EmployeeEmailMismatch", "This employee has an invitation for a different email.", "Revoke the old invitation before sending a new one.");

            return BuildInviteStatus(subject.EmployeeId, inviteByEmployee);
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
            return BuildInviteStatus(subject.EmployeeId, inviteByEmail);
        }

        return BuildUnprovisionedStatus(subject);
    }

    private async Task<InviteToken> CreateInviteAsync(
        Guid tenantId,
        WorkforceAccountSubjectDto subject,
        string role,
        CancellationToken cancellationToken)
    {
        var tenantExists = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AnyAsync(tenant => tenant.Id == tenantId && tenant.IsActive && !tenant.IsArchived, cancellationToken);
        if (!tenantExists)
            throw new InvalidOperationException("Tenant not found or inactive.");

        var currentUserId = User.GetUserId();
        var invite = InviteToken.Create(
            NormalizeEmail(subject.Email),
            tenantId,
            role,
            currentUserId,
            subject.FirstName,
            subject.LastName,
            subject.EmployeeId);

        dbContext.InviteTokens.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);
        return invite;
    }

    private async Task<ApplicationUser?> FindUserByEmployeeAsync(
        Guid tenantId,
        Guid employeeId,
        CancellationToken cancellationToken)
        => await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(user => user.TenantId == tenantId && user.EmployeeId == employeeId, cancellationToken);

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

    private async Task<WorkforceAccountStatusDto> BuildUserStatusAsync(Guid employeeId, ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new WorkforceAccountStatusDto
        {
            EmployeeId = employeeId,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            Role = PickWorkforceRole(roles),
            ProvisioningState = user.IsActive ? StateActive : StateInactive,
            UserId = user.Id,
            IsActive = user.IsActive,
            LastLoginAt = user.LastLoginAt
        };
    }

    private WorkforceAccountStatusDto BuildInviteStatus(Guid employeeId, InviteToken invite)
    {
        var state = invite.IsRevoked
            ? StateInviteRevoked
            : invite.IsUsed
                ? StateInviteAccepted
                : invite.IsExpired
                    ? StateInviteExpired
                    : StateInvitePending;
        var linkable = state == StateInvitePending;

        return new WorkforceAccountStatusDto
        {
            EmployeeId = employeeId,
            Email = invite.Email,
            FullName = BuildFullName(invite.FirstName, invite.LastName),
            Role = invite.Role,
            ProvisioningState = state,
            InviteId = invite.Id,
            InviteCreatedAt = invite.CreatedAt,
            InviteExpiresAt = invite.ExpiresAt,
            InviteLink = linkable ? BuildInviteLink(invite.Token) : null,
            DeliveryStatus = linkable ? "Suppressed" : null,
            DeliveryMessage = linkable ? "Email delivery is disabled in this environment." : null,
            DeliveryRecordedAt = linkable ? invite.CreatedAt : null
        };
    }

    private static WorkforceAccountStatusDto BuildUnprovisionedStatus(WorkforceAccountSubjectDto subject)
        => new()
        {
            EmployeeId = subject.EmployeeId,
            Email = NormalizeEmail(subject.Email),
            FullName = BuildFullName(subject.FirstName, subject.LastName),
            Role = PlatformRole.Employee,
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

    private static string? NormalizeWorkforceRole(string? role)
    {
        if (string.Equals(role, PlatformRole.Manager, StringComparison.OrdinalIgnoreCase))
            return PlatformRole.Manager;

        if (string.Equals(role, PlatformRole.Employee, StringComparison.OrdinalIgnoreCase))
            return PlatformRole.Employee;

        return null;
    }

    private static string PickWorkforceRole(IEnumerable<string> roles)
    {
        if (roles.Contains(PlatformRole.Manager))
            return PlatformRole.Manager;

        if (roles.Contains(PlatformRole.Employee))
            return PlatformRole.Employee;

        return roles.FirstOrDefault() ?? PlatformRole.Employee;
    }

    private static string? BuildFullName(string? firstName, string? lastName)
    {
        var fullName = $"{firstName} {lastName}".Trim();
        return string.IsNullOrWhiteSpace(fullName) ? null : fullName;
    }
}
