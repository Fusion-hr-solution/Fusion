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
[Route("api/identity/[controller]")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppIdentityDbContext _dbContext;

    public UsersController(UserManager<ApplicationUser> userManager, AppIdentityDbContext dbContext)
    {
        _userManager = userManager;
        _dbContext = dbContext;
    }

    /// <summary>
    /// Get all active users. HRAdmin sees only their tenant's users.
    /// PlatformAdmin sees all users (or filtered by X-Tenant-Id header).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<UserDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAll()
    {
        var query = _userManager.Users.Where(u => u.IsActive);

        // Apply tenant filter based on role
        var tenantId = GetEffectiveTenantId();
        if (tenantId.HasValue)
        {
            query = query.Where(u => u.TenantId == tenantId.Value);
        }

        var users = await query
            .Select(u => new UserDto
            {
                Id = u.Id,
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
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status400BadRequest)]
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

        // Check if email already exists
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
            return BadRequest(ApiResponse<UserDto>.Failure("Email is already registered."));

        // Validate and determine role
        var role = request.Role ?? PlatformRole.Employee;
        if (!PlatformRole.All.Contains(role))
            return BadRequest(ApiResponse<UserDto>.Failure($"Invalid role: {role}"));

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
            HireDate = request.HireDate.HasValue
                ? DateTime.SpecifyKind(request.HireDate.Value, DateTimeKind.Utc)
                : DateTime.UtcNow,
            TenantId = tenantId,
            EmailConfirmed = false // Requires email verification or password reset
        };

        var result = await _userManager.CreateAsync(user, temporaryPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return BadRequest(ApiResponse<UserDto>.Failure(errors));
        }

        // Assign role
        await _userManager.AddToRoleAsync(user, role);

        var dto = new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Department = user.Department,
            JobTitle = user.JobTitle,
            HireDate = user.HireDate,
            TenantId = user.TenantId,
            Roles = [role],
            TemporaryPassword = temporaryPassword // Only returned on creation
        };

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
    /// Generates a secure temporary password for new users.
    /// </summary>
    private static string GenerateTemporaryPassword()
    {
        // Generate a random password that meets complexity requirements
        const string uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const string lowercase = "abcdefghijklmnopqrstuvwxyz";
        const string digits = "0123456789";
        const string special = "!@#$%^&*";

        var random = new Random();
        var password = new char[12];

        // Ensure at least one of each required character type
        password[0] = uppercase[random.Next(uppercase.Length)];
        password[1] = lowercase[random.Next(lowercase.Length)];
        password[2] = digits[random.Next(digits.Length)];
        password[3] = special[random.Next(special.Length)];

        // Fill the rest randomly
        var allChars = uppercase + lowercase + digits + special;
        for (int i = 4; i < password.Length; i++)
        {
            password[i] = allChars[random.Next(allChars.Length)];
        }

        // Shuffle the password
        return new string(password.OrderBy(_ => random.Next()).ToArray());
    }
}