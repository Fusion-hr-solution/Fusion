using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Infrastructure.Evidence;

/// <summary>
/// Stores and retrieves progress-evidence file binaries behind a tenant-partitioned key. The MVP
/// uses a local object abstraction (filesystem in development); the contract stays storage-agnostic
/// so a real object store can replace it without touching callers. Never a shared document product —
/// each blob belongs to exactly one evidence item on one progress update.
/// </summary>
public interface IPerformanceEvidenceStore
{
    /// <summary>Persists a file for the current tenant and returns its opaque storage key.</summary>
    Task<string> SaveAsync(Stream content, string fileName, CancellationToken cancellationToken);

    /// <summary>Opens a stored file by key for the current tenant, or null if it is absent.</summary>
    Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken);

    Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

public sealed class LocalPerformanceEvidenceStore(ITenantContext tenant, string rootPath) : IPerformanceEvidenceStore
{
    public async Task<string> SaveAsync(Stream content, string fileName, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to store evidence.");

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var key = $"{tenant.TenantId:N}/{Guid.NewGuid():N}{extension}";
        var target = ResolvePath(key) ?? throw new ArgumentException("Invalid evidence file name.");
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);

        try
        {
            await using var file = File.Create(target);
            await content.CopyToAsync(file, cancellationToken);
        }
        catch
        {
            File.Delete(target);
            throw;
        }
        return key;
    }

    public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to read evidence.");

        var target = ResolvePath(storageKey);
        if (target is null || !File.Exists(target)) return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(target));
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to delete evidence.");
        cancellationToken.ThrowIfCancellationRequested();
        var target = ResolvePath(storageKey) ?? throw new ArgumentException("The evidence key does not belong to this tenant.");
        File.Delete(target);
        return Task.CompletedTask;
    }

    private string? ResolvePath(string key)
    {
        var parts = key.Split('/');
        if (parts.Length != 2 || parts[0] != $"{tenant.TenantId:N}" || parts[1].Contains('\\')
            || Path.GetFileName(parts[1]) != parts[1]
            || !Guid.TryParseExact(Path.GetFileNameWithoutExtension(parts[1]), "N", out _)) return null;
        var partition = Path.GetFullPath(Path.Combine(rootPath, parts[0])) + Path.DirectorySeparatorChar;
        var target = Path.GetFullPath(Path.Combine(partition, parts[1]));
        return target.StartsWith(partition, StringComparison.OrdinalIgnoreCase) ? target : null;
    }
}
