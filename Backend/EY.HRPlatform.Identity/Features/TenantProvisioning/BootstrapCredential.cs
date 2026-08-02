using System.Security.Cryptography;
using System.Text;

namespace EY.HRPlatform.Identity.Features.TenantProvisioning;

/// <summary>
/// A one-time organization-bootstrap credential, expressed as a random selector
/// plus a random secret.
///
/// The selector locates the invitation; only a digest of the secret is stored.
/// That split is what allows an indexed lookup without storing anything that can
/// activate a tenant: possessing the database gives you a selector and a digest,
/// neither of which reconstructs the link.
/// </summary>
public sealed record BootstrapCredential(string Selector, string Secret)
{
    private const int SelectorBytes = 16;
    private const int SecretBytes = 32;

    /// <summary>The value that travels in the delivery link. Never persisted.</summary>
    public string RawValue => $"{Selector}.{Secret}";

    public static BootstrapCredential Issue()
        => new(RandomToken(SelectorBytes), RandomToken(SecretBytes));

    /// <summary>
    /// Splits a presented credential. Returns false for anything malformed rather
    /// than throwing, so callers treat a bad credential exactly like a wrong one.
    /// </summary>
    public static bool TryParse(string? presented, out string selector, out string secret)
    {
        selector = string.Empty;
        secret = string.Empty;

        if (string.IsNullOrWhiteSpace(presented))
            return false;

        var separator = presented.IndexOf('.');
        if (separator <= 0 || separator == presented.Length - 1)
            return false;

        selector = presented[..separator];
        secret = presented[(separator + 1)..];
        return selector.Length <= 64 && secret.Length <= 128;
    }

    /// <summary>
    /// One-way digest of the secret. SHA-256 is appropriate here because the input
    /// is 32 bytes of cryptographic randomness, not a low-entropy password: there
    /// is nothing to brute-force, so a slow KDF would add cost without security.
    /// </summary>
    public static string Digest(string secret)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secret);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
    }

    /// <summary>
    /// Constant-time digest comparison, so verification time reveals nothing about
    /// how much of a guessed secret was correct.
    /// </summary>
    public static bool MatchesDigest(string? presentedSecret, string? storedDigest)
    {
        if (string.IsNullOrWhiteSpace(presentedSecret) || string.IsNullOrWhiteSpace(storedDigest))
            return false;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Digest(presentedSecret)),
            Encoding.UTF8.GetBytes(storedDigest));
    }

    private static string RandomToken(int byteCount)
    {
        var bytes = new byte[byteCount];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }
}
