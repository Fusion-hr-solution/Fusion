using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UploadChapterFileCommandHandler : ICommandHandler<UploadChapterFileCommand, Result<string>>
{
    private static readonly HashSet<string> AllowedExtensions = [".pdf", ".mp4", ".webm", ".mov"];
    private const long MaxFileSizeBytes = 50 * 1024 * 1024; // 50 MB

    private readonly ILogger<UploadChapterFileCommandHandler> _logger;
    private readonly IWebHostEnvironment _env;

    public UploadChapterFileCommandHandler(ILogger<UploadChapterFileCommandHandler> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public async Task<Result<string>> Handle(UploadChapterFileCommand request, CancellationToken cancellationToken)
    {
        var file = request.File;

        if (file is null || file.Length == 0)
            return Result.Failure<string>(Error.Validation("Upload.Empty", "No file provided or file is empty."));

        if (file.Length > MaxFileSizeBytes)
            return Result.Failure<string>(Error.Validation("Upload.TooLarge", "File exceeds the 50 MB size limit."));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            return Result.Failure<string>(Error.Validation("Upload.InvalidType",
                $"File type '{ext}' is not allowed. Allowed: {string.Join(", ", AllowedExtensions)}"));

        var uploadsDir = Path.Combine(
            _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"),
            "uploads", "chapters");
        Directory.CreateDirectory(uploadsDir);

        var uniqueName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, uniqueName);

        await using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream, cancellationToken);

        var fileUrl = $"/api/training/uploads/chapters/{uniqueName}";

        _logger.LogInformation("File uploaded: {FileName} → {FileUrl} ({Size} bytes)", file.FileName, fileUrl, file.Length);

        return Result.Success(fileUrl);
    }
}
