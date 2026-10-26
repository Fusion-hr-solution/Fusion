using System.Security.Claims;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Models.Requests;
using EY.HRPlatform.Identity.Models.Responses;
using EY.HRPlatform.SharedKernel.Localization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Identity.Controllers;

/// <summary>
/// The signed-in person's own account settings. Every action changes the account
/// named by the caller's token and nothing else: no route or body takes an
/// account id, so there is no way to aim it at someone else.
/// </summary>
[ApiController]
[Route("api/identity/account")]
[Authorize]
public class AccountController(AppIdentityDbContext dbContext) : ControllerBase
{
    public const string UnsupportedLanguageCode = "unsupported-language";

    /// <summary>
    /// Sets the person's language. No permission: like a password, it is their own.
    /// </summary>
    [HttpPut("language")]
    [ProducesResponseType(typeof(ApiResponse<AccountLanguageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AccountLanguageResponse>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<AccountLanguageResponse>>> SetLanguage(
        [FromBody] SetAccountLanguageRequest request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        if (!FusionLanguages.IsSupported(request.Language))
            return BadRequest(ApiResponse<AccountLanguageResponse>.Failure(
                "That language isn't available.", new { code = UnsupportedLanguageCode }));

        var user = await dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, cancellationToken);
        if (user is null)
            return Unauthorized();

        user.PreferredLanguage = request.Language;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ApiResponse<AccountLanguageResponse>.Success(
            new AccountLanguageResponse(FusionLanguages.Resolve(user.PreferredLanguage, null))));
    }
}
