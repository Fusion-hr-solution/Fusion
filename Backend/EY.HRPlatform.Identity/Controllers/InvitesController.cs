using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.AccessProfiles;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity")]
public class InvitesController : ControllerBase
{
    private readonly AppIdentityDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ITrainingServiceClient _trainingClient;
    private readonly IAccessProfileService _accessProfileService;

    public InvitesController(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ITrainingServiceClient trainingClient,
        IAccessProfileService accessProfileService)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _configuration = configuration;
        _trainingClient = trainingClient;
        _accessProfileService = accessProfileService;
    }

    /// <summary>
    /// Create an invitation for a user to join a tenant.
    /// HRAdmin can only invite to their own tenant with Employee/Manager roles.
    /// PlatformAdmin can invite to any tenant with any role.
    /// </summary>
    [HttpPost("tenants/{tenantId:guid}/invites")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<InviteDto>>> CreateInvite(
        Guid tenantId,
        [FromBody] CreateInviteRequest request,
        CancellationToken cancellationToken = default)
    {
        // Verify tenant exists
        var tenant = await _dbContext.Tenants.FindAsync(tenantId);
        if (tenant is null || !tenant.IsActive)
            return NotFound(ApiResponse<InviteDto>.Failure("Tenant not found."));

        // Check tenant access
        if (!CanAccessTenant(tenantId))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<InviteDto>.Failure("You do not have permission to invite users to this tenant."));

        // Validate role
        if (!PlatformRole.All.Contains(request.Role))
            return BadRequest(ApiResponse<InviteDto>.Failure($"Invalid role: {request.Role}"));

        // A tenant invitation grants customer-tenant participation, and a Platform
        // Administrator must hold zero customer memberships. No caller may issue
        // one for that role, including a Platform Administrator.
        if (request.Role == PlatformRole.PlatformAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<InviteDto>.Failure(
                    "Platform Administrators operate in the control plane and cannot be invited into a customer tenant."));
        }

        // HRAdmin cannot invite as HRAdmin
        if (!User.IsInRole(PlatformRole.PlatformAdmin) && request.Role == PlatformRole.HRAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<InviteDto>.Failure("You do not have permission to invite users with this role."));
        }

        // Normalize email once for consistent lookups
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalizedEmail))
            return BadRequest(ApiResponse<InviteDto>.Failure("Email is required."));

        // Check if email is already registered (cross-tenant uniqueness)
        var emailExists = await _dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == normalizedEmail.ToUpperInvariant());
        if (emailExists)
            return BadRequest(ApiResponse<InviteDto>.Failure("Email is already registered."));

        // Check for existing pending invite to same email in same tenant
        var existingInvite = await _dbContext.InviteTokens
            .Where(i => i.TenantId == tenantId &&
                        i.Email == normalizedEmail &&
                        i.AcceptedAt == null &&
                        !i.IsRevoked &&
                        i.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();

        if (existingInvite is not null)
            return BadRequest(ApiResponse<InviteDto>.Failure("A pending invitation already exists for this email."));

        if (request.EmployeeId.HasValue)
        {
            var employeeInviteExists = await _dbContext.InviteTokens
                .AnyAsync(i => i.TenantId == tenantId
                    && i.EmployeeId == request.EmployeeId
                    && i.AcceptedAt == null
                    && !i.IsRevoked
                    && i.ExpiresAt > DateTime.UtcNow);

            if (employeeInviteExists)
            {
                return Conflict(ApiResponse<InviteDto>.Failure("A pending invitation already exists for this employee."));
            }
        }

        // Get current user ID (GetUserId throws if not found, so wrap in try-catch)
        Guid currentUserId;
        try
        {
            currentUserId = User.GetUserId();
        }
        catch (InvalidOperationException)
        {
            return BadRequest(ApiResponse<InviteDto>.Failure("Unable to determine current user."));
        }

        // Create the invite (use normalizedEmail which is already validated non-null)
        var invite = InviteToken.Create(
            email: normalizedEmail,
            tenantId: tenantId,
            role: request.Role,
            createdByUserId: currentUserId,
            firstName: request.FirstName,
            lastName: request.LastName,
            employeeId: request.EmployeeId);

        _dbContext.InviteTokens.Add(invite);
        await _dbContext.SaveChangesAsync();

        var inviteLink = InvitationLinkBuilder.Build(_configuration, invite.Token);

        var dto = new InviteDto
        {
            Id = invite.Id,
            Token = invite.Token,
            InviteLink = inviteLink,
            Email = invite.Email,
            EmployeeId = invite.EmployeeId,
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            Role = invite.Role,
            AccessProfiles = (await _accessProfileService.GetInviteAccessProfilesAsync(invite.Id)).ToList(),
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt,
            DeliveryStatus = invite.DeliveryStatus,
            DeliveryMessage = invite.DeliveryMessage,
            DeliveryRecordedAt = invite.DeliveryRecordedAt
        };

        return CreatedAtAction(nameof(ValidateInvite), new { token = invite.Token },
            ApiResponse<InviteDto>.Success(dto));
    }

    /// <summary>
    /// Validate an invitation token and return its metadata.
    /// This is an anonymous endpoint for the invite acceptance flow.
    /// </summary>
    [HttpGet("invites/{token}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status410Gone)]
    public async Task<ActionResult<ApiResponse<InviteDto>>> ValidateInvite(string token)
    {
        // Anonymous endpoint — bypass tenant filter (no auth context)
        var invite = await _dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Include(i => i.Tenant)
            // Purpose is bound at creation, so a bootstrap invitation can never be
            // dispatched into the workforce route even if it ever carried a token.
            .Where(i => i.Purpose == InvitationPurpose.WorkforceAccount)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invite is null)
            return NotFound(ApiResponse<InviteDto>.Failure("Invalid invitation token."));

        if (invite.IsRevoked)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<InviteDto>.Failure("This invitation has been revoked."));

        if (invite.IsUsed)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<InviteDto>.Failure("This invitation has already been used."));

        if (invite.IsExpired)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<InviteDto>.Failure("This invitation has expired."));

        var dto = new InviteDto
        {
            Id = invite.Id,
            Email = invite.Email,
            EmployeeId = invite.EmployeeId,            TenantName = invite.Tenant?.Name ?? string.Empty,
            Role = invite.Role,
            AccessProfiles = (await _accessProfileService.GetInviteAccessProfilesAsync(invite.Id)).ToList(),
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt,
            DeliveryStatus = invite.DeliveryStatus,
            DeliveryMessage = invite.DeliveryMessage,
            DeliveryRecordedAt = invite.DeliveryRecordedAt
        };

        return Ok(ApiResponse<InviteDto>.Success(dto));
    }

    /// <summary>
    /// Accept an invitation and create a user account.
    /// This is an anonymous endpoint for the invite acceptance flow.
    /// </summary>
    [HttpPost("invites/{token}/accept")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status410Gone)]
    public async Task<ActionResult<ApiResponse<UserDto>>> AcceptInvite(
        string token,
        [FromBody] AcceptInviteRequest request)
    {
        // Anonymous endpoint — bypass tenant filter (no auth context)
        var invite = await _dbContext.InviteTokens
            .IgnoreQueryFilters()
            .Include(i => i.Tenant)
            .Where(i => i.Purpose == InvitationPurpose.WorkforceAccount)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invite is null)
            return NotFound(ApiResponse<UserDto>.Failure("Invalid invitation token."));

        if (invite.IsRevoked)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<UserDto>.Failure("This invitation has been revoked."));

        if (invite.IsUsed)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<UserDto>.Failure("This invitation has already been used."));

        if (invite.IsExpired)
            return StatusCode(StatusCodes.Status410Gone,
                ApiResponse<UserDto>.Failure("This invitation has expired."));

        // Determine names (from request or invite; treat empty as not provided)
        var firstName = string.IsNullOrWhiteSpace(request.FirstName) ? invite.FirstName : request.FirstName;
        var lastName = string.IsNullOrWhiteSpace(request.LastName) ? invite.LastName : request.LastName;

        if (string.IsNullOrWhiteSpace(firstName))
            return BadRequest(ApiResponse<UserDto>.Failure("First name is required."));

        if (string.IsNullOrWhiteSpace(lastName))
            return BadRequest(ApiResponse<UserDto>.Failure("Last name is required."));

        // Double-check email isn't registered (cross-tenant uniqueness, race condition protection)
        var emailTaken = await _dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == invite.Email.ToUpperInvariant());
        if (emailTaken)
            return BadRequest(ApiResponse<UserDto>.Failure("Email is already registered."));

        // The local Development profile uses EF InMemory, which does not support transactions.
        IDbContextTransaction? transaction = null;
        if (_dbContext.Database.IsRelational())
            transaction = await _dbContext.Database.BeginTransactionAsync();

        // Track whether we created the user so we can clean up on partial failure
        ApplicationUser? createdUser = null;

        try
        {
            // Create the user
            var user = new ApplicationUser
            {
                UserName = invite.Email,
                Email = invite.Email,
                EmployeeId = invite.EmployeeId,
                FirstName = firstName.Trim(),
                LastName = lastName.Trim(),
                EmailConfirmed = true, // Invited users are pre-verified
                HireDate = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToArray();
                return BadRequest(ApiResponse<UserDto>.Failure(errors));
            }

            createdUser = user;

            // Assign role
            var roleResult = await _userManager.AddToRoleAsync(user, invite.Role);
            if (!roleResult.Succeeded)
            {
                if (transaction is not null)
                    await transaction.RollbackAsync();

                var errors = roleResult.Errors.Select(e => e.Description).ToArray();
                return BadRequest(ApiResponse<UserDto>.Failure(errors));
            }

            // Defence in depth against a pre-existing invitation issued before the
            // role was blocked at creation: accepting it must never produce a
            // Platform Administrator with a customer membership.
            if (string.Equals(invite.Role, PlatformRole.PlatformAdmin, StringComparison.Ordinal))
            {
                if (transaction is not null)
                    await transaction.RollbackAsync();

                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<UserDto>.Failure(
                        "This invitation cannot be accepted because Platform Administrators cannot hold customer tenant membership."));
            }

            // Membership is the tenancy authority, so it must exist before any
            // tenant access is assigned to the new account.
            _dbContext.TenantMemberships.Add(TenantMembership.Create(user.Id, invite.TenantId));
            await _dbContext.SaveChangesAsync();

            await _accessProfileService.ApplyInviteProfilesAsync(invite, user);

            // Mark invite as used
            invite.MarkAccepted(user.Id);
            await _dbContext.SaveChangesAsync();

            if (transaction is not null)
                await transaction.CommitAsync();

            createdUser = null; // Success — don't clean up

            // Fire-and-forget: provision downstream employee profile for workforce users.
            if (invite.EmployeeId.HasValue && IsWorkforceUserRole(invite.Role))
                _ = _trainingClient.ProvisionEmployeeAsync(user.Id);

            var dto = new UserDto
            {
                Id = user.Id,
                EmployeeId = user.EmployeeId,
                Email = user.Email!,
                FullName = user.FullName,
                Department = user.Department,
                JobTitle = user.JobTitle,
                HireDate = user.HireDate,
                TenantId = invite.TenantId,
                Roles = [invite.Role],
                AccessProfiles = (await _accessProfileService.GetAssignedProfilesAsync(user)).ToList(),
            };

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<UserDto>.Success(dto));
        }
        catch
        {
            if (transaction is not null)
                await transaction.RollbackAsync();

            throw;
        }
        finally
        {
            if (transaction is not null)
                await transaction.DisposeAsync();

            // InMemory cleanup: if user was created but not fully processed, remove it
            if (createdUser is not null && transaction is null)
            {
                try { await _userManager.DeleteAsync(createdUser); } catch { /* best-effort */ }
            }
        }
    }

    /// <summary>
    /// List pending invitations for a tenant.
    /// </summary>
    [HttpGet("tenants/{tenantId:guid}/invites")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse<List<InviteDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<List<InviteDto>>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<List<InviteDto>>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<List<InviteDto>>>> ListInvites(
        Guid tenantId,
        [FromQuery] bool includePast = false)
    {
        // Verify tenant exists
        var tenant = await _dbContext.Tenants.FindAsync(tenantId);
        if (tenant is null)
            return NotFound(ApiResponse<List<InviteDto>>.Failure("Tenant not found."));

        // Check tenant access
        if (!CanAccessTenant(tenantId))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<List<InviteDto>>.Failure("You do not have permission to view invites for this tenant."));

        var query = _dbContext.InviteTokens
            .Where(i => i.TenantId == tenantId);

        if (!includePast)
        {
            query = query.Where(i => i.AcceptedAt == null && !i.IsRevoked && i.ExpiresAt > DateTime.UtcNow);
        }

        var invites = await query
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        var dtos = new List<InviteDto>(invites.Count);
        foreach (var invite in invites)
        {
            dtos.Add(new InviteDto
            {
                Id = invite.Id,
                Email = invite.Email,
                EmployeeId = invite.EmployeeId,
                TenantId = invite.TenantId,
                TenantName = tenant.Name,
                Role = invite.Role,
                AccessProfiles = (await _accessProfileService.GetInviteAccessProfilesAsync(invite.Id)).ToList(),
                FirstName = invite.FirstName,
                LastName = invite.LastName,
                ExpiresAt = invite.ExpiresAt,
                IsExpired = invite.ExpiresAt < DateTime.UtcNow,
                IsUsed = invite.AcceptedAt != null,
                CreatedAt = invite.CreatedAt,
            });
        }

        return Ok(ApiResponse<List<InviteDto>>.Success(dtos));
    }

    /// <summary>
    /// Revoke a pending invitation.
    /// </summary>
    [HttpDelete("invites/{inviteId:guid}")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> RevokeInvite(Guid inviteId)
    {
        var invite = await _dbContext.InviteTokens.FindAsync(inviteId);
        if (invite is null)
            return NotFound(ApiResponse.Failure("Invitation not found."));

        // Check tenant access
        if (!CanAccessTenant(invite.TenantId))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Failure("You do not have permission to revoke this invitation."));

        if (invite.IsUsed)
            return BadRequest(ApiResponse.Failure("Cannot revoke an already accepted invitation."));

        if (invite.IsRevoked)
            return BadRequest(ApiResponse.Failure("Invitation is already revoked."));

        invite.Revoke();
        await _dbContext.SaveChangesAsync();

        return Ok(ApiResponse.Success());
    }

    /// <summary>
    /// Resend an invitation by extending its expiry.
    /// </summary>
    [HttpPost("invites/{inviteId:guid}/resend")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<InviteDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<InviteDto>>> ResendInvite(
        Guid inviteId,
        CancellationToken cancellationToken = default)
    {
        var invite = await _dbContext.InviteTokens
            .Include(i => i.Tenant)
            .FirstOrDefaultAsync(i => i.Id == inviteId);

        if (invite is null)
            return NotFound(ApiResponse<InviteDto>.Failure("Invitation not found."));

        // Check tenant access
        if (!CanAccessTenant(invite.TenantId))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<InviteDto>.Failure("You do not have permission to resend this invitation."));

        if (invite.IsUsed)
            return BadRequest(ApiResponse<InviteDto>.Failure("Cannot resend an already accepted invitation."));

        // Extend expiry (default 7 days from now)
        invite.ExtendExpiry();
        await _dbContext.SaveChangesAsync();

        var inviteLink = InvitationLinkBuilder.Build(_configuration, invite.Token);

        var dto = new InviteDto
        {
            Id = invite.Id,
            Token = invite.Token,
            InviteLink = inviteLink,
            Email = invite.Email,
            EmployeeId = invite.EmployeeId,
            TenantId = invite.TenantId,
            TenantName = invite.Tenant?.Name ?? string.Empty,
            Role = invite.Role,
            AccessProfiles = (await _accessProfileService.GetInviteAccessProfilesAsync(invite.Id)).ToList(),
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt,
            DeliveryStatus = invite.DeliveryStatus,
            DeliveryMessage = invite.DeliveryMessage,
            DeliveryRecordedAt = invite.DeliveryRecordedAt
        };

        return Ok(ApiResponse<InviteDto>.Success(dto));
    }

    /// <summary>
    /// Dev-only: remove an orphaned user by email (partial-failure cleanup on InMemory).
    /// </summary>
    [HttpDelete("dev/users/{email}")]
    [Authorize(Roles = PlatformRole.PlatformAdmin)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> DeleteUserByEmail(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return NotFound(ApiResponse.Failure("User not found."));

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return BadRequest(ApiResponse.Failure(errors));
        }

        return Ok(ApiResponse.Success());
    }

    private bool CanAccessTenant(Guid tenantId)
    {
        // Inviting into a customer tenant is customer-workspace administration,
        // so it requires the caller's own membership in that tenant. Platform
        // Administrator status is control-plane authority and grants no bypass.
        var userTenantId = User.GetTenantId();
        return userTenantId.HasValue && userTenantId.Value == tenantId;
    }

    private static bool IsWorkforceUserRole(string role)
        => role == PlatformRole.Employee || role == PlatformRole.Manager;
}
