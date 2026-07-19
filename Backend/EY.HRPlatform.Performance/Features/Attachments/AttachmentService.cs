using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Attachments;

public sealed record AttachmentDto(
    Guid Id,
    string OwnerType,
    Guid? OwnerId,
    string FileName,
    string ContentType,
    long SizeBytes,
    string Status,
    DateTime CreatedAt,
    DateTime? CommittedAt);

public sealed record AttachmentDownload(Stream Content, string ContentType, string FileName);

/// <summary>
/// Stores and streams attachments. Enforces tenant scope, size, and content-type limits; resource
/// ownership authorization is delegated to the consuming feature (passed in as a decision on
/// download). Successful commits are written to the shared activity log.
/// </summary>
public interface IAttachmentService
{
    Task<Result<AttachmentDto>> UploadAsync(
        string ownerType,
        Guid? ownerId,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken);

    Task<Result<AttachmentDownload>> DownloadAsync(
        Guid attachmentId,
        Func<Attachment, Task<bool>> authorize,
        CancellationToken cancellationToken);
}

public sealed class AttachmentService(
    PerformanceDbContext db,
    IAttachmentStorage storage,
    IActivityLog activityLog,
    ITenantContext tenantContext,
    Security.ICurrentUserContext currentUser,
    IOptions<AttachmentOptions> options) : IAttachmentService
{
    public async Task<Result<AttachmentDto>> UploadAsync(
        string ownerType,
        Guid? ownerId,
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            return Result.Failure<AttachmentDto>(
                Error.Forbidden("Attachment.Disabled", "Attachment uploads are disabled."));
        }

        if (string.IsNullOrWhiteSpace(ownerType))
        {
            return Result.Failure<AttachmentDto>(
                Error.Validation("Attachment.OwnerRequired", "An owner type is required."));
        }

        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Result.Failure<AttachmentDto>(
                Error.Validation("Attachment.FileNameRequired", "A file name is required."));
        }

        var normalizedContentType = string.IsNullOrWhiteSpace(contentType)
            ? "application/octet-stream"
            : contentType.Trim();

        if (settings.AllowedContentTypes.Length > 0
            && !settings.AllowedContentTypes.Contains(normalizedContentType, StringComparer.OrdinalIgnoreCase))
        {
            return Result.Failure<AttachmentDto>(
                Error.Validation("Attachment.TypeNotAllowed", $"Content type '{normalizedContentType}' is not allowed."));
        }

        // Buffer with a hard cap so an oversized upload is rejected before any bytes are stored.
        using var buffer = new MemoryStream();
        var cap = settings.MaxSizeBytes;
        var read = new byte[81920];
        long size = 0;
        int n;
        while ((n = await content.ReadAsync(read, cancellationToken)) > 0)
        {
            size += n;
            if (size > cap)
            {
                return Result.Failure<AttachmentDto>(
                    Error.Validation("Attachment.TooLarge", $"The file exceeds the maximum size of {cap} bytes."));
            }

            await buffer.WriteAsync(read.AsMemory(0, n), cancellationToken);
        }

        if (size == 0)
        {
            return Result.Failure<AttachmentDto>(
                Error.Validation("Attachment.Empty", "The file is empty."));
        }

        var attachment = Attachment.CreatePending(
            tenantContext.TenantId, ownerType, ownerId,
            currentUser.UserId ?? Guid.Empty, fileName, normalizedContentType, size);

        buffer.Position = 0;
        await storage.PutAsync(attachment.StorageKey, buffer, cancellationToken);

        attachment.Commit(DateTime.UtcNow);
        db.Attachments.Add(attachment);

        activityLog.Record(
            action: "AttachmentUploaded",
            subjectType: "Attachment",
            subjectId: attachment.Id,
            metadata: new { attachment.OwnerType, attachment.OwnerId, attachment.FileName, attachment.SizeBytes });

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(ToDto(attachment));
    }

    public async Task<Result<AttachmentDownload>> DownloadAsync(
        Guid attachmentId,
        Func<Attachment, Task<bool>> authorize,
        CancellationToken cancellationToken)
    {
        // Tenant scope enforced by the global query filter.
        var attachment = await db.Attachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == attachmentId, cancellationToken);
        if (attachment is null)
        {
            return Result.Failure<AttachmentDownload>(Error.NotFound("Attachment", attachmentId));
        }

        var authorized = await authorize(attachment);
        if (!authorized)
        {
            return Result.Failure<AttachmentDownload>(
                Error.Forbidden("Attachment.Forbidden", "You are not authorized to access this attachment."));
        }

        var stream = await storage.OpenReadAsync(attachment.StorageKey, cancellationToken);
        if (stream is null)
        {
            return Result.Failure<AttachmentDownload>(Error.NotFound("Attachment", attachmentId));
        }

        return Result.Success(new AttachmentDownload(stream, attachment.ContentType, attachment.FileName));
    }

    private static AttachmentDto ToDto(Attachment a)
        => new(a.Id, a.OwnerType, a.OwnerId, a.FileName, a.ContentType, a.SizeBytes,
            a.Status.ToString(), a.CreatedAt, a.CommittedAt);
}
