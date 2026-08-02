using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantProvisioning;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// The fingerprint decides whether a repeated key is an honest retry or a
/// conflicting reuse, so it must ignore cosmetic differences and notice every
/// meaningful one.
/// </summary>
public sealed class ProvisioningFingerprintTests
{
    private static ProvisionTenantRequest Request() => new()
    {
        Name = "Atlas Group",
        Locale = "en-US",
        TimeZone = "Europe/Paris",
        Modules = [TenantModule.CoreHR, TenantModule.Performance],
        AdministratorEmail = "admin@atlas.example",
        IdempotencyKey = "key-1",
    };

    [Fact]
    public void Identical_requests_share_a_fingerprint()
        => Assert.Equal(Request().ComputeFingerprint(), Request().ComputeFingerprint());

    [Theory]
    [InlineData("  Atlas Group  ")]
    [InlineData("atlas group")]
    [InlineData("ATLAS GROUP")]
    public void Cosmetic_differences_do_not_change_the_fingerprint(string name)
    {
        // An operator retrying with different casing or stray whitespace means the
        // same thing and must not be told their key conflicts.
        var varied = Request() with { Name = name };
        Assert.Equal(Request().ComputeFingerprint(), varied.ComputeFingerprint());
    }

    [Fact]
    public void Module_order_does_not_change_the_fingerprint()
    {
        var reordered = Request() with
        {
            Modules = [TenantModule.Performance, TenantModule.CoreHR],
        };

        Assert.Equal(Request().ComputeFingerprint(), reordered.ComputeFingerprint());
    }

    [Fact]
    public void Omitting_mandatory_core_hr_does_not_change_the_fingerprint()
    {
        // Core HR is always provisioned, so selecting it explicitly or not
        // describes the same resulting tenant.
        var implicitCore = Request() with { Modules = [TenantModule.Performance] };
        Assert.Equal(Request().ComputeFingerprint(), implicitCore.ComputeFingerprint());
    }

    [Fact]
    public void Absent_locale_matches_the_explicit_default()
    {
        var absent = Request() with { Locale = null };
        var explicitDefault = Request() with { Locale = "en-US" };

        Assert.Equal(explicitDefault.ComputeFingerprint(), absent.ComputeFingerprint());
    }

    [Fact]
    public void Every_meaningful_field_changes_the_fingerprint()
    {
        var baseline = Request().ComputeFingerprint();

        Assert.NotEqual(baseline, (Request() with { Name = "Other Group" }).ComputeFingerprint());
        Assert.NotEqual(baseline, (Request() with { TimeZone = "UTC" }).ComputeFingerprint());
        Assert.NotEqual(baseline, (Request() with { Locale = "fr-FR" }).ComputeFingerprint());
        Assert.NotEqual(baseline, (Request() with { AdministratorEmail = "other@atlas.example" }).ComputeFingerprint());
        Assert.NotEqual(baseline, (Request() with { Modules = [TenantModule.CoreHR] }).ComputeFingerprint());
    }

    [Fact]
    public void Fingerprint_ignores_the_idempotency_key_itself()
    {
        // The key identifies the attempt; the fingerprint describes the content.
        var differentKey = Request() with { IdempotencyKey = "key-2" };
        Assert.Equal(Request().ComputeFingerprint(), differentKey.ComputeFingerprint());
    }

    [Fact]
    public void Normalized_modules_always_include_core_hr()
    {
        var withoutCore = Request() with { Modules = [] };
        Assert.Contains(TenantModule.CoreHR, withoutCore.NormalizedModules());

        var duplicated = Request() with { Modules = [TenantModule.CoreHR, TenantModule.CoreHR] };
        Assert.Single(duplicated.NormalizedModules(), module => module == TenantModule.CoreHR);
    }
}
