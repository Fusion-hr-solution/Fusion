using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Training.Controllers;

[ApiController]
[Route("api/training/admin/uploads")]
[Authorize(Roles = $"{PlatformRole.PlatformAdmin},{PlatformRole.HRAdmin}")]
public class AdminUploadsController : ControllerBase
{
    private static readonly HashSet<string> AllowedExtensions = [".pdf", ".mp4", ".webm", ".mov"];
    private const long MaxFileSizeBytes = 50 * 1024 * 1024; // 50 MB

    private readonly ILogger<AdminUploadsController> _logger;
    private readonly IWebHostEnvironment _env;

    public AdminUploadsController(ILogger<AdminUploadsController> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    /// <summary>Upload a chapter content file (PDF or video).</summary>
    [HttpPost]
    [RequestSizeLimit(MaxFileSizeBytes)]
    [ProducesResponseType(typeof(ApiResponse<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse.Failure("No file provided or file is empty."));

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(ApiResponse.Failure("File exceeds the 50 MB size limit."));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return BadRequest(ApiResponse.Failure($"File type '{ext}' is not allowed. Allowed: {string.Join(", ", AllowedExtensions)}"));

        try
        {
            var uploadsDir = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads", "chapters");
            Directory.CreateDirectory(uploadsDir);

            var uniqueName = $"{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(uploadsDir, uniqueName);

            await using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream, cancellationToken);

            var fileUrl = $"/api/training/uploads/chapters/{uniqueName}";

            _logger.LogInformation("File uploaded: {FileName} → {FileUrl} ({Size} bytes)", file.FileName, fileUrl, file.Length);

            return Ok(ApiResponse<string>.Success(fileUrl));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload file {FileName}", file.FileName);
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse.Failure("An error occurred while uploading the file."));
        }
    }
}
