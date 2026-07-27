using EY.HRPlatform.DemoSeed;

namespace EY.HRPlatform.Identity.Tests.Infrastructure;

public sealed class CanonicalSeedReceiptTests
{
    [Fact]
    public void Receipt_is_stable_and_contains_manifest_fingerprint()
    {
        var first = CanonicalSeedReceipt.Create(CanonicalDemoSeed.TenantId, CanonicalDemoSeed.AsOfUtc);
        var second = CanonicalSeedReceipt.Create(CanonicalDemoSeed.TenantId, CanonicalDemoSeed.AsOfUtc);

        Assert.Equal(first.Id, second.Id);
        Assert.Equal(CanonicalDemoSeed.ManifestVersion, first.ManifestVersion);
        Assert.Equal(CanonicalDemoSeed.ManifestHash, first.ManifestHash);
    }
}
