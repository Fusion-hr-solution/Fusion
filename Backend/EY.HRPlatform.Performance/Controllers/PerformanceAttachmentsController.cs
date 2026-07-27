using EY.HRPlatform.Performance.Features.Attachments;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

[ApiController]
[Route("api/performance/attachments")]
[Authorize]
public class PerformanceAttachmentsController(
    IAttachmentService attachments,
    IAttachmentOwnerAuthorization ownerAuthorization) : PerformanceControllerBase
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
            return Denied();
        }

        if (file is null || file.Length == 0)
        {
            return Problem(StatusCodes.Status400BadRequest, "Attachment.FileRequired", "A file is required.");
        }

        await using var stream = file.OpenReadStream();
        var result = await attachments.UploadAsync(
            ownerType, ownerId, file.FileName, file.ContentType, stream, cancellationToken);

        if (result.IsFailure)
        {
            // The code decides the outcome; nothing branches on message text.
            return IsForbidden(result.Error) ? Denied() : Problem(result.Error);
        }

        return Ok(ApiResponse<AttachmentDto>.Success(result.Value));
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
            // A denial and a missing attachment answer identically, so neither discloses
            // whether the record exists.
            return IsForbidden(result.Error) ? Denied() : Problem(result.Error);
        }

        var download = result.Value;

        // Never let the browser second-guess the stored type, and never let it render the bytes
        // inline: a download is a file the user saves, not a document the origin executes.
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        return File(download.Content, download.ContentType, download.FileName);
    }

    // The Error record carries no type discriminator, so forbidden outcomes are matched by their codes.
    private static bool IsForbidden(Error error) =>
        error.Code is "Attachment.Disabled" or "Attachment.Unauthenticated" or "Attachment.Forbidden";
}
