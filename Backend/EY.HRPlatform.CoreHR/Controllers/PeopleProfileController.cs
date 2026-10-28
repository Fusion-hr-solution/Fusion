using System.Security.Claims;
using EY.HRPlatform.CoreHR.Features.People;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Infrastructure.Photos;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Controllers;

/// <summary>
/// The profile's Personal tab, photo and job history (B-127, B-129). Who may read or change what is decided
/// in the handlers from <see cref="PeopleViewer"/>, built here from the caller's claims only. Cross-tenant keys
/// fall to the tenant filter and come back as not found.
/// </summary>
[ApiController]
[Route("api/corehr/employees/people/{employeeKey}")]
[Authorize]
public sealed class PeopleProfileController(
    ISender sender,
    ICoreAccessPolicyService accessPolicy,
    IEmployeePhotoStore photoStore) : ControllerBase
{
    [HttpGet("personal")]
    [ProducesResponseType(typeof(ApiResponse<PeoplePersonalDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPersonal(string employeeKey, CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();

        var result = await sender.Send(new PeoplePersonalQuery(employeeKey, Viewer()), cancellationToken);
        if (result.IsFailure)
            return Failure(result.Error);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";
        return Ok(ApiResponse<PeoplePersonalDto>.Success(result.Value));
    }

    /// <summary>Replaces the Personal tab. The person or a people admin; applies at once and lands in history.</summary>
    [HttpPut("personal")]
    [ProducesResponseType(typeof(ApiResponse<PeoplePersonalDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status412PreconditionFailed)]
    public async Task<IActionResult> UpdatePersonal(
        string employeeKey,
        [FromBody] UpdatePersonalRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();
        if (!uint.TryParse(ifMatch?.Trim().Trim('"'), out var expectedVersion))
            return StatusCode(StatusCodes.Status412PreconditionFailed,
                ApiResponse.Failure("If-Match header with valid version is required for updates."));

        var result = await sender.Send(
            new UpdatePeoplePersonalCommand(employeeKey, Viewer(), expectedVersion, request, Actor()),
            cancellationToken);
        if (result.IsFailure)
            return Failure(result.Error);

        Response.Headers.ETag = $"\"{result.Value.Version}\"";
        return Ok(ApiResponse<PeoplePersonalDto>.Success(result.Value));
    }

    /// <summary>The Job information table: HR and the person's branch manager.</summary>
    [HttpGet("job-history")]
    [ProducesResponseType(typeof(ApiResponse<PeopleJobHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetJobHistory(string employeeKey, CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();

        var result = await sender.Send(new PeopleJobHistoryQuery(employeeKey, Viewer()), cancellationToken);
        return result.IsFailure
            ? Failure(result.Error)
            : Ok(ApiResponse<PeopleJobHistoryDto>.Success(result.Value));
    }

    /// <summary>
    /// The photo, for anyone who can open the profile. With the current <paramref name="v"/> it is cached for good;
    /// a new upload changes the version and so the address.
    /// </summary>
    [HttpGet("photo")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhoto(string employeeKey, [FromQuery] string? v, CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();

        var result = await sender.Send(new EmployeePhotoQuery(employeeKey), cancellationToken);
        if (result.IsFailure)
            return NotFound(ApiResponse.Failure("No photo."));
        var stream = await photoStore.OpenAsync(result.Value.StorageKey, cancellationToken);
        if (stream is null)
            return NotFound(ApiResponse.Failure("No photo."));

        Response.Headers.CacheControl = v == result.Value.Version
            ? "private, max-age=31536000, immutable"
            : "private, no-cache";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(stream, result.Value.ContentType, enableRangeProcessing: false,
            entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{result.Value.Version}\""),
            lastModified: null);
    }

    /// <summary>Sets the photo: a JPEG, PNG or WebP up to 5 MB, checked by its bytes.</summary>
    [HttpPost("photo")]
    [RequestSizeLimit(EmployeePhotos.MaxBytes + 64 * 1024)]
    [ProducesResponseType(typeof(ApiResponse<EmployeePhotoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UploadPhoto(string employeeKey, IFormFile? file, CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();

        var result = await sender.Send(new UploadEmployeePhotoCommand(employeeKey, Viewer(), file, Actor()), cancellationToken);
        return result.IsFailure ? Failure(result.Error) : Ok(ApiResponse<EmployeePhotoDto>.Success(result.Value));
    }

    [HttpDelete("photo")]
    [ProducesResponseType(typeof(ApiResponse<EmployeePhotoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RemovePhoto(string employeeKey, CancellationToken cancellationToken)
    {
        if (!CanOpenProfiles())
            return Forbid();

        var result = await sender.Send(new RemoveEmployeePhotoCommand(employeeKey, Viewer(), Actor()), cancellationToken);
        return result.IsFailure ? Failure(result.Error) : Ok(ApiResponse<EmployeePhotoDto>.Success(result.Value));
    }

    /// <summary>The same gate as opening a profile: any worker in the tenant with a view permission.</summary>
    private bool CanOpenProfiles() => accessPolicy.GetEmployeeViewScope(User) is not null;

    private PeopleViewer Viewer() => new(
        User.GetEmployeeId(),
        accessPolicy.CanManageEmployees(User),
        accessPolicy.CanViewTenantEmployees(User),
        accessPolicy.CanViewTeam(User),
        accessPolicy.CanUpdateOwnProfile(User));

    private string Actor()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
        var name = User.FindFirstValue(CustomClaimTypes.FullName)
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? "Unknown user";
        return $"{id}|{name}";
    }

    private ObjectResult Failure(Error error) => error.Code switch
    {
        PeopleAccess.ForbiddenCode => StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Failure(error.Message)),
        _ when error.Code.EndsWith(".NotFound", StringComparison.Ordinal) => NotFound(ApiResponse.Failure(error.Message)),
        _ => BadRequest(ApiResponse.Failure(error.Message)),
    };
}
