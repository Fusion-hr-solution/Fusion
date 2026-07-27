using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Attachments;

/// <summary>
/// Byte-store for attachments, keyed by an opaque, tenant-partitioned storage key. The filesystem
/// implementation is the current backend; the interface is the swap seam for a cloud/blob store
/// later without touching consumers. Bytes never live in the database.
/// </summary>
public interface IAttachmentStorage
{
    Task PutAsync(string storageKey, Stream content, CancellationToken cancellationToken);
    Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken);
    Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

/// <summary>
/// Filesystem-backed storage. Storage keys are "{tenantId}/{attachmentId}", so bytes are partitioned
/// by tenant on disk. Keys are sanitized to stay within the configured root (no traversal).
/// </summary>
public sealed class FileSystemAttachmentStorage(IOptions<AttachmentOptions> options) : IAttachmentStorage
{
    private readonly string _root = Path.GetFullPath(options.Value.StorageRoot);

    public async Task PutAsync(string storageKey, Stream content, CancellationToken cancellationToken)
    {
        var path = ResolvePath(storageKey);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(file, cancellationToken);
    }

    public Task<Stream?> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var path = ResolvePath(storageKey);
        if (!File.Exists(path))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        var path = ResolvePath(storageKey);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }

    private string ResolvePath(string storageKey)
    {
        // Reject path traversal; keys are server-generated "{tenantId}/{attachmentId}" but stay defensive.
        var segments = storageKey.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Any(s => s is "." or ".." || s.Contains('\\')))
        {
            throw new ArgumentException("Invalid storage key.", nameof(storageKey));
        }

        var path = Path.GetFullPath(Path.Combine(_root, Path.Combine(segments)));

        // Compare on a path-segment boundary, not on a textual prefix: a sibling directory that
        // merely starts with the root's name — "…/attachments-elsewhere" against a root of
        // "…/attachments" — would otherwise be accepted as inside it.
        if (!IsInsideRoot(path))
        {
            throw new ArgumentException("Storage key escapes the storage root.", nameof(storageKey));
        }

        return path;
    }

    private bool IsInsideRoot(string candidate)
    {
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;

        // Path casing is platform-dependent; matching the filesystem's own comparison avoids both
        // false rejections on Windows and false acceptances elsewhere.
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;

        return candidate.StartsWith(rootWithSeparator, comparison);
    }
}
