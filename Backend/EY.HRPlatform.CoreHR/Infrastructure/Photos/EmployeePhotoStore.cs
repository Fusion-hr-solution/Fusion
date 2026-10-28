using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Infrastructure.Photos;

/// <summary>
/// Stores profile photo binaries behind a tenant-partitioned key, like Performance evidence: a local
/// filesystem store for development and the test host, and a storage-agnostic contract so the production
/// object store (B-053) can replace it without touching callers.
/// </summary>
public interface IEmployeePhotoStore
{
    /// <summary>Persists a photo for the current tenant and returns its opaque storage key.</summary>
    Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken);

    /// <summary>Opens a stored photo by key for the current tenant, or null if it is absent.</summary>
    Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken);

    Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

public sealed class LocalEmployeePhotoStore(ITenantContext tenant, string rootPath) : IEmployeePhotoStore
{
    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to store a photo.");

        var key = $"{tenant.TenantId:N}/{Guid.NewGuid():N}{extension}";
        var target = ResolvePath(key) ?? throw new ArgumentException("Invalid photo extension.", nameof(extension));
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
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to read a photo.");

        var target = ResolvePath(storageKey);
        if (target is null || !File.Exists(target)) return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(target));
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved) throw new InvalidOperationException("A resolved tenant is required to delete a photo.");
        cancellationToken.ThrowIfCancellationRequested();
        var target = ResolvePath(storageKey) ?? throw new ArgumentException("The photo key does not belong to this tenant.");
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

/// <summary>Production until a private object store is chosen (B-053): photos can't be stored and none are found.</summary>
public sealed class UnconfiguredEmployeePhotoStore : IEmployeePhotoStore
{
    public Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken)
        => throw new InvalidOperationException("Profile photo storage is not configured for this environment.");

    public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken)
        => Task.FromResult<Stream?>(null);

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken) => Task.CompletedTask;
}
