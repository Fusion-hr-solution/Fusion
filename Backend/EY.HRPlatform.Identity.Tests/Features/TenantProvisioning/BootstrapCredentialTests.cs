using EY.HRPlatform.Identity.Features.TenantProvisioning;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// Credential safety: nothing reusable is stored, and verification does not leak
/// how close a guess was.
/// </summary>
public sealed class BootstrapCredentialTests
{
    [Fact]
    public void Issued_credentials_are_unique_and_split_into_selector_and_secret()
    {
        var first = BootstrapCredential.Issue();
        var second = BootstrapCredential.Issue();

        Assert.NotEqual(first.Selector, second.Selector);
        Assert.NotEqual(first.Secret, second.Secret);
        Assert.Equal($"{first.Selector}.{first.Secret}", first.RawValue);
    }

    [Fact]
    public void Digest_does_not_contain_the_secret()
    {
        var credential = BootstrapCredential.Issue();
        var digest = BootstrapCredential.Digest(credential.Secret);

        // The stored value must not be the secret, nor contain it.
        Assert.NotEqual(credential.Secret, digest);
        Assert.DoesNotContain(credential.Secret, digest, StringComparison.Ordinal);
        Assert.Equal(64, digest.Length); // SHA-256 hex
    }

    [Fact]
    public void Digest_is_deterministic_and_distinct_per_secret()
    {
        var credential = BootstrapCredential.Issue();

        Assert.Equal(
            BootstrapCredential.Digest(credential.Secret),
            BootstrapCredential.Digest(credential.Secret));
        Assert.NotEqual(
            BootstrapCredential.Digest(credential.Secret),
            BootstrapCredential.Digest(BootstrapCredential.Issue().Secret));
    }

    [Fact]
    public void Matching_accepts_only_the_issued_secret()
    {
        var credential = BootstrapCredential.Issue();
        var digest = BootstrapCredential.Digest(credential.Secret);

        Assert.True(BootstrapCredential.MatchesDigest(credential.Secret, digest));
        Assert.False(BootstrapCredential.MatchesDigest(BootstrapCredential.Issue().Secret, digest));
        Assert.False(BootstrapCredential.MatchesDigest(null, digest));
        Assert.False(BootstrapCredential.MatchesDigest(credential.Secret, null));
        Assert.False(BootstrapCredential.MatchesDigest("", digest));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("no-separator")]
    [InlineData(".leading")]
    [InlineData("trailing.")]
    public void Malformed_credentials_are_rejected_without_throwing(string? presented)
    {
        // A malformed credential must behave exactly like a wrong one, so an
        // attacker cannot distinguish "bad shape" from "bad secret".
        Assert.False(BootstrapCredential.TryParse(presented, out _, out _));
    }

    [Fact]
    public void Well_formed_credentials_round_trip()
    {
        var credential = BootstrapCredential.Issue();

        Assert.True(BootstrapCredential.TryParse(credential.RawValue, out var selector, out var secret));
        Assert.Equal(credential.Selector, selector);
        Assert.Equal(credential.Secret, secret);
    }
}
