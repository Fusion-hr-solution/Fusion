using EY.HRPlatform.Performance.Features.Attachments;
using EY.HRPlatform.SharedKernel.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/attachments")]
[Authorize]
public class PerformanceAttachmentsController(
    IAttachmentService attachments,
    IAttachmentOwnerAuthorization ownerAuthorization) : ControllerBase
{
    /// <summary>
    /// Multipart upload. The owning feature supplies the owner type/id; the attachment layer enforces
    /// tenant scope, size, and content-type limits. Bytes stream from the request into storage.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<IActionResult> Upload(
        [FromForm] string ownerType,
        [FromForm] Guid? ownerId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (!await ownerAuthorization.CanUploadAsync(ownerType, ownerId, User, cancellationToken))
        {
            return Forbid();
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(ApiResponse.Failure("A file is required."));
        }

        await using var stream = file.OpenReadStream();
        var result = await attachments.UploadAsync(
            ownerType, ownerId, file.FileName, file.ContentType, stream, cancellationToken);

        return result.IsFailure
            ? BadRequest(ApiResponse.Failure(result.Error.Message))
            : Ok(ApiResponse<AttachmentDto>.Success(result.Value));
    }

    /// <summary>
    /// Streamed download. The owning-feature policy validates the stored owner before bytes are opened.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var result = await attachments.DownloadAsync(
            id,
            attachment => ownerAuthorization.CanDownloadAsync(
                attachment.OwnerType,
                attachment.OwnerId,
                User,
                cancellationToken),
            cancellationToken);
        if (result.IsFailure)
        {
            return result.Error.Code == "Attachment.Forbidden"
                ? Forbid()
                : NotFound(ApiResponse.Failure(result.Error.Message));
        }

        var download = result.Value;
        return File(download.Content, download.ContentType, download.FileName);
    }
}
