using EY.HRPlatform.CoreHR.Features.People;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// Reads about the signed-in person themselves. Each one takes no person id: the employee comes from the
/// caller's token in the current tenant, so it can never return anyone else.
/// </summary>
[ApiController]
[Route("api/corehr/me")]
[Authorize]
public sealed class MeController(ISender sender) : ControllerBase
{
    /// <summary>
    /// The caller's own card (name, job title, org unit, as of today) for the Fusion sidebar. Needs only a
    /// signed-in tenant session: it is the person's own record. 404 when the account has no employee here.
    /// </summary>
    [HttpGet("card")]
    [ProducesResponseType(typeof(ApiResponse<MyCardDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCard(CancellationToken cancellationToken)
    {
        if (User.GetTenantId() is null || User.GetEmployeeId() is not { } employeeId)
            return NotFound(ApiResponse.Failure("No linked employee record."));

        var result = await sender.Send(new MyCardQuery(employeeId, DateTime.UtcNow), cancellationToken);
        return result.IsFailure
            ? NotFound(ApiResponse.Failure(result.Error.Message))
            : Ok(ApiResponse<MyCardDto>.Success(result.Value));
    }
}
