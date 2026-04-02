using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity")]
public class InvitesController : ControllerBase
{
    private readonly AppIdentityDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;

    public InvitesController(
        AppIdentityDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _configuration = configuration;
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
        [FromBody] CreateInviteRequest request)
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

        // HRAdmin cannot invite as PlatformAdmin or HRAdmin
        if (!User.IsInRole(PlatformRole.PlatformAdmin) &&
            (request.Role == PlatformRole.PlatformAdmin || request.Role == PlatformRole.HRAdmin))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<InviteDto>.Failure("You do not have permission to invite users with this role."));
        }

        // Normalize email once for consistent lookups
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalizedEmail))
            return BadRequest(ApiResponse<InviteDto>.Failure("Email is required."));

        // Check if email is already registered
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser is not null)
            return BadRequest(ApiResponse<InviteDto>.Failure("Email is already registered."));

        // Check for existing pending invite to same email in same tenant
        var existingInvite = await _dbContext.InviteTokens
            .Where(i => i.TenantId == tenantId &&
                        i.Email == normalizedEmail &&
                        i.AcceptedAt == null &&
                        i.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();

        if (existingInvite is not null)
            return BadRequest(ApiResponse<InviteDto>.Failure("A pending invitation already exists for this email."));

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
            lastName: request.LastName);

        _dbContext.InviteTokens.Add(invite);
        await _dbContext.SaveChangesAsync();

        // Build invite link
        var baseUrl = _configuration["Application:BaseUrl"] ?? "http://localhost:3000";
        baseUrl = baseUrl.TrimEnd('/');
        var inviteLink = $"{baseUrl}/invite/{invite.Token}";

        var dto = new InviteDto
        {
            Id = invite.Id,
            Token = invite.Token,
            InviteLink = inviteLink,
            Email = invite.Email,
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            Role = invite.Role,
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt
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
        var invite = await _dbContext.InviteTokens
            .Include(i => i.Tenant)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invite is null)
            return NotFound(ApiResponse<InviteDto>.Failure("Invalid invitation token."));

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
            TenantId = invite.TenantId,
            TenantName = invite.Tenant?.Name ?? string.Empty,
            Role = invite.Role,
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt
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
        var invite = await _dbContext.InviteTokens
            .Include(i => i.Tenant)
            .FirstOrDefaultAsync(i => i.Token == token);

        if (invite is null)
            return NotFound(ApiResponse<UserDto>.Failure("Invalid invitation token."));

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

        // Double-check email isn't registered (race condition protection)
        var existingUser = await _userManager.FindByEmailAsync(invite.Email);
        if (existingUser is not null)
            return BadRequest(ApiResponse<UserDto>.Failure("Email is already registered."));

        // Use transaction to ensure atomicity of user creation + role assignment + invite marking
        await using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Create the user
            var user = new ApplicationUser
            {
                UserName = invite.Email,
                Email = invite.Email,
                FirstName = firstName.Trim(),
                LastName = lastName.Trim(),
                TenantId = invite.TenantId,
                EmailConfirmed = true, // Invited users are pre-verified
                HireDate = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToArray();
                return BadRequest(ApiResponse<UserDto>.Failure(errors));
            }

            // Assign role
            var roleResult = await _userManager.AddToRoleAsync(user, invite.Role);
            if (!roleResult.Succeeded)
            {
                await transaction.RollbackAsync();
                var errors = roleResult.Errors.Select(e => e.Description).ToArray();
                return BadRequest(ApiResponse<UserDto>.Failure(errors));
            }

            // Mark invite as used
            invite.MarkAccepted(user.Id);
            await _dbContext.SaveChangesAsync();

            await transaction.CommitAsync();

            var dto = new UserDto
            {
                Id = user.Id,
                Email = user.Email!,
                FullName = user.FullName,
                Department = user.Department,
                JobTitle = user.JobTitle,
                HireDate = user.HireDate,
                TenantId = user.TenantId,
                Roles = [invite.Role]
            };

            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<UserDto>.Success(dto));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
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
            query = query.Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTime.UtcNow);
        }

        var invites = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InviteDto
            {
                Id = i.Id,
                Email = i.Email,
                TenantId = i.TenantId,
                TenantName = tenant.Name,
                Role = i.Role,
                FirstName = i.FirstName,
                LastName = i.LastName,
                ExpiresAt = i.ExpiresAt,
                IsExpired = i.ExpiresAt < DateTime.UtcNow,
                IsUsed = i.AcceptedAt != null,
                CreatedAt = i.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<InviteDto>>.Success(invites));
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

        _dbContext.InviteTokens.Remove(invite);
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
    public async Task<ActionResult<ApiResponse<InviteDto>>> ResendInvite(Guid inviteId)
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

        // Build invite link
        var baseUrl = _configuration["Application:BaseUrl"] ?? "http://localhost:3000";
        baseUrl = baseUrl.TrimEnd('/');
        var inviteLink = $"{baseUrl}/invite/{invite.Token}";

        var dto = new InviteDto
        {
            Id = invite.Id,
            Token = invite.Token,
            InviteLink = inviteLink,
            Email = invite.Email,
            TenantId = invite.TenantId,
            TenantName = invite.Tenant?.Name ?? string.Empty,
            Role = invite.Role,
            FirstName = invite.FirstName,
            LastName = invite.LastName,
            ExpiresAt = invite.ExpiresAt,
            IsExpired = invite.IsExpired,
            IsUsed = invite.IsUsed,
            CreatedAt = invite.CreatedAt
        };

        return Ok(ApiResponse<InviteDto>.Success(dto));
    }

    private bool CanAccessTenant(Guid tenantId)
    {
        if (User.IsInRole(PlatformRole.PlatformAdmin))
            return true;

        var userTenantId = User.GetTenantId();
        return userTenantId.HasValue && userTenantId.Value == tenantId;
    }
}
