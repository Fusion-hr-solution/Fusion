using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;
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
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly AppIdentityDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ITokenService tokenService,
        AppIdentityDbContext dbContext,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _dbContext = dbContext;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(
        [FromBody] RegisterRequest request)
    {
        // Check if email already exists
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
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
            HireDate = DateTime.SpecifyKind(request.HireDate, DateTimeKind.Utc)
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
        // Find user by email
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !user.IsActive)
            return Unauthorized(ApiResponse<AuthResponse>.Failure("Invalid credentials."));

        // Verify password
        var signInResult = await _signInManager
            .CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);

        if (!signInResult.Succeeded)
            return Unauthorized(ApiResponse<AuthResponse>.Failure("Invalid credentials."));

        // Update last login timestamp
        user.LastLoginAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

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

        // Find the user
        var user = await _userManager.FindByIdAsync(storedToken.UserId.ToString());
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
            AccessToken = accessToken,
            RefreshToken = refreshTokenString,
            AccessTokenExpiration = DateTime.UtcNow.AddMinutes(
                int.Parse(_configuration["Jwt:ExpirationInMinutes"]!))
        };
    }
}