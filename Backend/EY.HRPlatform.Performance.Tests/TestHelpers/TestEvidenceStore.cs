using EY.HRPlatform.Performance.Infrastructure.Evidence;

namespace EY.HRPlatform.Performance.Tests.TestHelpers;

public sealed class TestEvidenceStore(Guid tenantId) : IPerformanceEvidenceStore
{
    public Dictionary<string, byte[]> Files { get; } = [];
    public async Task<string> SaveAsync(Stream content, string fileName, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        var key = $"{tenantId:N}/{Guid.NewGuid():N}{Path.GetExtension(fileName)}";
        Files.Add(key, buffer.ToArray());
        return key;
    }
    public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken)
        => Task.FromResult<Stream?>(Files.TryGetValue(storageKey, out var bytes) ? new MemoryStream(bytes, writable: false) : null);
    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        Files.Remove(storageKey);
        return Task.CompletedTask;
    }
}
