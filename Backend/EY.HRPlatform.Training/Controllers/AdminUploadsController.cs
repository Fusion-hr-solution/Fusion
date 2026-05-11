using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Features.Admin.Commands;
using EY.HRPlatform.Training.Models.Responses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/uploads")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminUploadsController : ControllerBase
{
    private readonly ISender _sender;

    public AdminUploadsController(ISender sender) => _sender = sender;

    /// <summary>Upload a chapter content file (PDF or video).</summary>
    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)]
    [ProducesResponseType(typeof(ApiResponse<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new UploadChapterFileCommand(file), cancellationToken);

        if (result.IsFailure)
            return BadRequest(ApiResponse.Failure(result.Error.Message));

        return Ok(ApiResponse<string>.Success(result.Value));
    }
}
