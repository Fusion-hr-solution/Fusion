using EY.HRPlatform.DemoSeed;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public sealed class CanonicalSeedReceiptTests
{
    [Fact]
    public void Refresh_preserves_identity_and_current_manifest()
    {
        var receipt = CanonicalSeedReceipt.Create(CanonicalDemoSeed.TenantId, CanonicalDemoSeed.AsOfUtc);
        var id = receipt.Id;

        receipt.Refresh(CanonicalDemoSeed.AsOfUtc.AddHours(1));

        Assert.Equal(id, receipt.Id);
        Assert.Equal(CanonicalDemoSeed.ManifestVersion, receipt.ManifestVersion);
        Assert.Equal(CanonicalDemoSeed.ManifestHash, receipt.ManifestHash);
    }
}
