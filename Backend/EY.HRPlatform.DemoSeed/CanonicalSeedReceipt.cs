namespace EY.HRPlatform.DemoSeed;

/// <summary>Service-local proof that the canonical manifest was applied successfully.</summary>
public sealed class CanonicalSeedReceipt
{
    private CanonicalSeedReceipt() { }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string ManifestVersion { get; private set; } = string.Empty;
    public string ManifestHash { get; private set; } = string.Empty;
    public DateTime CompletedAtUtc { get; private set; }

    public static CanonicalSeedReceipt Create(Guid tenantId, DateTime completedAtUtc) => new()
    {
        Id = CanonicalDemoSeed.DeterministicGuid("seed-receipt:" + tenantId),
        TenantId = tenantId,
        ManifestVersion = CanonicalDemoSeed.ManifestVersion,
        ManifestHash = CanonicalDemoSeed.ManifestHash,
        CompletedAtUtc = completedAtUtc.ToUniversalTime()
    };

    public void Refresh(DateTime completedAtUtc)
    {
        ManifestVersion = CanonicalDemoSeed.ManifestVersion;
        ManifestHash = CanonicalDemoSeed.ManifestHash;
        CompletedAtUtc = completedAtUtc.ToUniversalTime();
    }
}
