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
}

public sealed class LocalPerformanceEvidenceStore(ITenantContext tenant, string rootPath) : IPerformanceEvidenceStore
{
    public async Task<string> SaveAsync(Stream content, string fileName, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to store evidence.");

        var extension = Path.GetExtension(fileName);
        var key = $"{tenant.TenantId:N}/{Guid.NewGuid():N}{extension}";
        var target = Path.Combine(rootPath, key.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);

        await using var file = File.Create(target);
        await content.CopyToAsync(file, cancellationToken);
        return key;
    }

    public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to read evidence.");

        // Fail closed on tenant boundary: a key must live under the caller's tenant partition.
        if (!storageKey.StartsWith($"{tenant.TenantId:N}/", StringComparison.Ordinal))
            return Task.FromResult<Stream?>(null);

        var target = Path.Combine(rootPath, storageKey.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(target)) return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(target));
    }
}
