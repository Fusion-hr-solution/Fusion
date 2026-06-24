using System.Security.Cryptography;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/[controller]")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppIdentityDbContext _dbContext;
    private readonly ITrainingServiceClient _trainingClient;

    public UsersController(
        UserManager<ApplicationUser> userManager,
        AppIdentityDbContext dbContext,
        ITrainingServiceClient trainingClient)
    {
        _userManager = userManager;
        _dbContext = dbContext;
        _trainingClient = trainingClient;
    }

    /// <summary>
    /// Get all active users. HRAdmin sees only their tenant's users (via query filter).
    /// PlatformAdmin sees all users or filtered by X-Tenant-Id header (resolved by middleware).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<UserDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAll()
    {
        // PlatformAdmin without X-Tenant-Id header needs to see all tenants
        // The middleware doesn't set tenant context when PlatformAdmin omits the header,
        // so the fail-open filter returns all users. For non-PlatformAdmin, the middleware
        // always sets tenant context from JWT, so the filter scopes automatically.
        var query = _userManager.Users.Where(u => u.IsActive);

        var users = await query
            .Select(u => new UserDto
            {
                Id = u.Id,
                EmployeeId = u.EmployeeId,
                Email = u.Email!,
                FullName = u.FullName,
                Department = u.Department,
                JobTitle = u.JobTitle,
                HireDate = u.HireDate,
                TenantId = u.TenantId
            })
            .ToListAsync();

        return Ok(ApiResponse<List<UserDto>>.Success(users));
    }

    /// <summary>
    /// Get a specific user by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetById(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse<UserDto>.Failure("User not found."));

        // Check tenant access
        if (!CanAccessTenant(user.TenantId))
            return NotFound(ApiResponse<UserDto>.Failure("User not found."));

        var roles = await _userManager.GetRolesAsync(user);

        var dto = new UserDto
        {
            Id = user.Id,
            EmployeeId = user.EmployeeId,
            Email = user.Email!,
            FullName = user.FullName,
            Department = user.Department,
            JobTitle = user.JobTitle,
            HireDate = user.HireDate,
            TenantId = user.TenantId,
            Roles = roles.ToList()
        };

        return Ok(ApiResponse<UserDto>.Success(dto));
    }

    /// <summary>
    /// Create a new user in the specified tenant.
    /// HRAdmin can only create users in their own tenant.
    /// PlatformAdmin can create users in any tenant.
    /// </summary>
    [HttpPost("/api/identity/tenants/{tenantId:guid}/users")]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser(
        Guid tenantId,
        [FromBody] CreateUserRequest request)
    {
        // Verify tenant exists
        var tenant = await _dbContext.Tenants.FindAsync(tenantId);
        if (tenant is null)
            return NotFound(ApiResponse<UserDto>.Failure("Tenant not found."));

        // Check tenant access
        if (!CanAccessTenant(tenantId))
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<UserDto>.Failure("You do not have permission to create users in this tenant."));

        // Check if email already exists (cross-tenant uniqueness)
        var normalizedEmail = request.Email?.Trim().ToUpperInvariant();
        var emailExists = await _dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == normalizedEmail);
        if (emailExists)
            return BadRequest(ApiResponse<UserDto>.Failure("Email is already registered."));

        // Validate and determine role
        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(ApiResponse<UserDto>.Failure(
                "Role is required for admin-created users. Use workforce invitations for Employee or Manager access."));
        }

        var role = request.Role.Trim();
        if (!PlatformRole.All.Contains(role))
            return BadRequest(ApiResponse<UserDto>.Failure($"Invalid role: {role}"));

        if (role is PlatformRole.Employee or PlatformRole.Manager)
        {
            return BadRequest(ApiResponse<UserDto>.Failure(
                "Core workforce access for employees and managers must be activated from a trusted employee record invitation."));
        }

        // HRAdmin cannot assign PlatformAdmin or HRAdmin roles
        if (!User.IsInRole(PlatformRole.PlatformAdmin) &&
            (role == PlatformRole.PlatformAdmin || role == PlatformRole.HRAdmin))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<UserDto>.Failure("You do not have permission to assign this role."));
        }

        // Generate temporary password
        var temporaryPassword = GenerateTemporaryPassword();

        // Create the user
        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Department = request.Department,
            JobTitle = request.JobTitle,
            HireDate = DateTime.SpecifyKind(request.HireDate, DateTimeKind.Utc),
            TenantId = tenantId,
            EmailConfirmed = false
        };

        var result = await _userManager.CreateAsync(user, temporaryPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return BadRequest(ApiResponse<UserDto>.Failure(errors));
        }

        // Assign role (with rollback on failure)
        var roleResult = await _userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            // Rollback: delete the user if role assignment fails
            await _userManager.DeleteAsync(user);
            var errors = roleResult.Errors.Select(e => e.Description).ToArray();
            return BadRequest(ApiResponse<UserDto>.Failure(errors));
        }

        var dto = new UserDto
        {
            Id = user.Id,
            Email = user.Email!,
            FullName = user.FullName,
            Department = user.Department,
            JobTitle = user.JobTitle,
            HireDate = user.HireDate,
            TenantId = user.TenantId,
            EmployeeId = user.EmployeeId,
            Roles = [role],
            TemporaryPassword = temporaryPassword // Only returned on creation
        };

        // Fire-and-forget: provision/sync EmployeeProfile (name + email) in Training service
        if (role == PlatformRole.Employee)
            _ = _trainingClient.ProvisionEmployeeAsync(user.Id, user.FullName, user.Email);

        return CreatedAtAction(nameof(GetById), new { id = user.Id },
            ApiResponse<UserDto>.Success(dto));
    }

    /// <summary>
    /// Assign a role to a user.
    /// </summary>
    [HttpPost("{id:guid}/roles/{role}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> AssignRole(Guid id, string role)
    {
        // Validate role exists
        if (!PlatformRole.All.Contains(role))
            return BadRequest(ApiResponse.Failure($"Invalid role: {role}"));

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse.Failure("User not found."));

        // Check tenant access
        if (!CanAccessTenant(user.TenantId))
            return NotFound(ApiResponse.Failure("User not found."));

        // HRAdmin cannot assign PlatformAdmin or HRAdmin roles
        if (!User.IsInRole(PlatformRole.PlatformAdmin) &&
            (role == PlatformRole.PlatformAdmin || role == PlatformRole.HRAdmin))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Failure("You do not have permission to assign this role."));
        }

        var result = await _userManager.AddToRoleAsync(user, role);
        if (!result.Succeeded)
            return BadRequest(ApiResponse.Failure(
                result.Errors.Select(e => e.Description).ToArray()));

        // Fire-and-forget: provision/sync EmployeeProfile (name + email) in Training service
        if (role == PlatformRole.Employee)
            _ = _trainingClient.ProvisionEmployeeAsync(id, user.FullName, user.Email);

        return Ok(ApiResponse.Success());
    }

    /// <summary>
    /// Remove a role from a user.
    /// </summary>
    [HttpDelete("{id:guid}/roles/{role}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> RemoveRole(Guid id, string role)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound(ApiResponse.Failure("User not found."));

        // Check tenant access
        if (!CanAccessTenant(user.TenantId))
            return NotFound(ApiResponse.Failure("User not found."));

        // HRAdmin cannot remove PlatformAdmin or HRAdmin roles
        if (!User.IsInRole(PlatformRole.PlatformAdmin) &&
            (role == PlatformRole.PlatformAdmin || role == PlatformRole.HRAdmin))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Failure("You do not have permission to remove this role."));
        }

        var result = await _userManager.RemoveFromRoleAsync(user, role);
        if (!result.Succeeded)
            return BadRequest(ApiResponse.Failure(
                result.Errors.Select(e => e.Description).ToArray()));

        return Ok(ApiResponse.Success());
    }

    /// <summary>
    /// One-time backfill: re-syncs every existing Employee user's name + email into the Training
    /// service. Idempotent (provisioning upserts). PlatformAdmin only.
    /// </summary>
    [HttpPost("sync-to-training")]
    [Authorize(Roles = PlatformRole.PlatformAdmin)]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<int>>> SyncEmployeesToTraining(CancellationToken cancellationToken)
    {
        var employees = await _userManager.GetUsersInRoleAsync(PlatformRole.Employee);

        var count = 0;
        foreach (var employee in employees)
        {
            await _trainingClient.ProvisionEmployeeAsync(employee.Id, employee.FullName, employee.Email, cancellationToken);
            count++;
        }

        return Ok(ApiResponse<int>.Success(count));
    }

    /// <summary>
    /// Gets the effective tenant ID for the current request.
    /// PlatformAdmin can use X-Tenant-Id header, others use their JWT tenant.
    /// </summary>
    private Guid? GetEffectiveTenantId()
    {
        // PlatformAdmin without X-Tenant-Id header sees all tenants
        if (User.IsInRole(PlatformRole.PlatformAdmin))
        {
            if (Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue) &&
                Guid.TryParse(headerValue.FirstOrDefault(), out var headerTenantId) &&
                headerTenantId != Guid.Empty)
            {
                return headerTenantId;
            }
            return null; // No filter - see all
        }

        // Non-PlatformAdmin users are restricted to their JWT tenant
        return User.GetTenantId();
    }

    /// <summary>
    /// Checks if the current user can access the specified tenant.
    /// </summary>
    private bool CanAccessTenant(Guid tenantId)
    {
        // PlatformAdmin can access any tenant
        if (User.IsInRole(PlatformRole.PlatformAdmin))
            return true;

        // Others can only access their own tenant
        var userTenantId = User.GetTenantId();
        return userTenantId.HasValue && userTenantId.Value == tenantId;
    }

    /// <summary>
    /// Generates a cryptographically secure temporary password for new users.
    /// </summary>
    private static string GenerateTemporaryPassword()
    {
        const string uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const string lowercase = "abcdefghijklmnopqrstuvwxyz";
        const string digits = "0123456789";
        const string special = "!@#$%^&*";
        const string allChars = uppercase + lowercase + digits + special;
        const int passwordLength = 12;

        var password = new char[passwordLength];

        // Ensure at least one of each required character type using crypto RNG
        password[0] = uppercase[GetCryptoRandomIndex(uppercase.Length)];
        password[1] = lowercase[GetCryptoRandomIndex(lowercase.Length)];
        password[2] = digits[GetCryptoRandomIndex(digits.Length)];
        password[3] = special[GetCryptoRandomIndex(special.Length)];

        // Fill the rest randomly
        for (int i = 4; i < passwordLength; i++)
        {
            password[i] = allChars[GetCryptoRandomIndex(allChars.Length)];
        }

        // Fisher-Yates shuffle using crypto RNG
        for (int i = passwordLength - 1; i > 0; i--)
        {
            int j = GetCryptoRandomIndex(i + 1);
            (password[i], password[j]) = (password[j], password[i]);
        }

        return new string(password);
    }

    /// <summary>
    /// Gets a cryptographically secure random index in the range [0, maxExclusive).
    /// </summary>
    private static int GetCryptoRandomIndex(int maxExclusive)
    {
        return RandomNumberGenerator.GetInt32(maxExclusive);
    }
}
