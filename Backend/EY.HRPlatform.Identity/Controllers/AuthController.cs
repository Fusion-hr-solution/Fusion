using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

[ApiController]
[Route("api/identity/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;
    private readonly AppIdentityDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService,
        AppIdentityDbContext dbContext,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _dbContext = dbContext;
        _configuration = configuration;
    }

    /// <summary>
    /// Register a new user. Requires HRAdmin or PlatformAdmin role.
    /// For B2B HR platforms, users are provisioned by admins, not self-registered.
    /// Use POST /api/identity/tenants/{tenantId}/users for admin-provisioned user creation.
    /// </summary>
    [HttpPost("register")]
    [Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(
        [FromBody] RegisterRequest request)
    {
        // Get the caller's tenant ID for the new user
        var callerTenantId = User.GetTenantId();
        if (!callerTenantId.HasValue || callerTenantId.Value == Guid.Empty)
        {
            return BadRequest(ApiResponse<AuthResponse>.Failure(
                "Cannot determine tenant context. Use POST /api/identity/tenants/{tenantId}/users instead."));
        }

        // Check if email already exists (cross-tenant uniqueness)
        var normalizedRegEmail = request.Email?.Trim().ToUpperInvariant();
        var existingUser = await _dbContext.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.NormalizedEmail == normalizedRegEmail);
        if (existingUser)
            return BadRequest(ApiResponse<AuthResponse>.Failure("Email is already registered."));

        // Create the user entity
        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Department = request.Department,
            JobTitle = request.JobTitle,
            HireDate = DateTime.SpecifyKind(request.HireDate, DateTimeKind.Utc),
            TenantId = callerTenantId.Value
        };

        // Save to database with hashed password
        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return BadRequest(ApiResponse<AuthResponse>.Failure(errors));
        }

        // Assign default role
        await _userManager.AddToRoleAsync(user, PlatformRole.Employee);

        // Generate tokens and return
        var authResponse = await GenerateAuthResponseAsync(user);
        return Ok(ApiResponse<AuthResponse>.Success(authResponse));
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(
        [FromBody] LoginRequest request)
    {
        // Find user by email — bypass tenant filter since no JWT exists at login time
        var normalizedEmail = request.Email?.Trim().ToUpperInvariant();
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail);
        if (user is null || !user.IsActive)
            return Unauthorized(ApiResponse<AuthResponse>.Failure("Invalid credentials."));

        // Verify password directly (SignInManager uses UserManager which is affected by query filters)
        var verificationResult = _userManager.PasswordHasher
            .VerifyHashedPassword(user, user.PasswordHash!, request.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
            return Unauthorized(ApiResponse<AuthResponse>.Failure("Invalid credentials."));

        // Rehash inline if the hasher settings have changed since the password was last set
        if (verificationResult == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, request.Password);

        // Update last login timestamp (and persists rehash if applicable)
        user.LastLoginAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        // Generate tokens and return
        var authResponse = await GenerateAuthResponseAsync(user);
        return Ok(ApiResponse<AuthResponse>.Success(authResponse));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh(
        [FromBody] RefreshTokenRequest request)
    {
        // Find the refresh token in database
        var storedToken = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken);

        if (storedToken is null || !storedToken.IsActive)
            return Unauthorized(ApiResponse<AuthResponse>.Failure(
                "Invalid or expired refresh token."));

        // Revoke the old token (one-time use)
        storedToken.RevokedAt = DateTime.UtcNow;

        // Find the user — bypass tenant filter since refresh may happen without tenant context
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == storedToken.UserId);
        if (user is null || !user.IsActive)
            return Unauthorized(ApiResponse<AuthResponse>.Failure(
                "User not found or deactivated."));

        // Generate new token pair
        var authResponse = await GenerateAuthResponseAsync(user);
        await _dbContext.SaveChangesAsync();

        return Ok(ApiResponse<AuthResponse>.Success(authResponse));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<ActionResult<ApiResponse>> Logout()
    {
        // Get current user's ID from the JWT claims
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId is null)
            return Unauthorized();

        // Revoke ALL refresh tokens for this user
        var tokens = await _dbContext.RefreshTokens
            .Where(rt => rt.UserId == Guid.Parse(userId) && rt.RevokedAt == null)
            .ToListAsync();

        foreach (var token in tokens)
            token.RevokedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return Ok(ApiResponse.Success());
    }

    /// <summary>
    /// Helper method: generates access token + refresh token + builds the response
    /// </summary>
    private async Task<AuthResponse> GenerateAuthResponseAsync(ApplicationUser user)
    {
        // Generate both tokens
        var accessToken = await _tokenService.GenerateAccessTokenAsync(user);
        var refreshTokenString = _tokenService.GenerateRefreshToken();

        // Save refresh token to database
        var refreshToken = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshTokenString,
            ExpiresAt = DateTime.UtcNow.AddDays(
                int.Parse(_configuration["Jwt:RefreshTokenExpirationInDays"]!))
        };

        _dbContext.RefreshTokens.Add(refreshToken);
        await _dbContext.SaveChangesAsync();

        // Get user roles
        var roles = await _userManager.GetRolesAsync(user);

        // Build response
        return new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email!,
            FullName = user.FullName,
            Roles = roles.ToList(),
            EmployeeId = user.EmployeeId,
            AccessToken = accessToken,
            RefreshToken = refreshTokenString,
            AccessTokenExpiration = DateTime.UtcNow.AddMinutes(
                int.Parse(_configuration["Jwt:ExpirationInMinutes"]!))
        };
    }
}
