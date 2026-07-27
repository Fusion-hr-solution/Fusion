using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Attachments;

/// <summary>
/// Database-backed attachment bytes, so any replica can read any attachment (design D11).
/// </summary>
/// <remarks>
/// <para>
/// The problem this solves is deployment shape, not storage elegance: node-local disk pins the
/// module to a single replica, because a download routed to a different instance cannot find the
/// file. Object storage is the textbook answer and needs infrastructure, credentials, and a
/// lifecycle policy this project has not provisioned; Postgres solves the actual problem with none.
/// </para>
/// <para>
/// Stated plainly: this grows the database and puts binary traffic through the connection pool. The
/// 10 MB cap and the abandoned-upload sweep bound it, and <see cref="IAttachmentStorage"/> is what
/// makes moving to object storage later a swap rather than a rewrite.
/// </para>
/// </remarks>
public sealed class PostgresAttachmentStorage(PerformanceDbContext dbContext) : IAttachmentStorage
{
    public async Task PutAsync(string storageKey, Stream content, CancellationToken cancellationToken)
    {
        StorageKeyGuard.Validate(storageKey);

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);

        var existing = await dbContext.AttachmentBlobs
            .FirstOrDefaultAsync(blob => blob.StorageKey == storageKey, cancellationToken);

        if (existing is null)
        {
            dbContext.AttachmentBlobs.Add(AttachmentBlob.Create(storageKey, buffer.ToArray()));
        }
        else
        {
            // Re-putting the same key replaces its bytes, matching the filesystem backend's
            // FileMode.Create behaviour.
            existing.Replace(buffer.ToArray());
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        StorageKeyGuard.Validate(storageKey);

        var content = await dbContext.AttachmentBlobs
            .AsNoTracking()
            .Where(blob => blob.StorageKey == storageKey)
            .Select(blob => blob.Content)
            .FirstOrDefaultAsync(cancellationToken);

        return content is null ? null : new MemoryStream(content, writable: false);
    }

    public async Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        StorageKeyGuard.Validate(storageKey);

        await dbContext.AttachmentBlobs
            .Where(blob => blob.StorageKey == storageKey)
            .ExecuteDeleteAsync(cancellationToken);
    }
}

/// <summary>
/// Storage-key validation shared by both backends, so a key that one rejects cannot be accepted by
/// the other.
/// </summary>
public static class StorageKeyGuard
{
    public static void Validate(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            throw new ArgumentException("A storage key is required.", nameof(storageKey));
        }

        var segments = storageKey.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0 || segments.Any(segment => segment is "." or ".." || segment.Contains('\\')))
        {
            throw new ArgumentException("Invalid storage key.", nameof(storageKey));
        }
    }
}
