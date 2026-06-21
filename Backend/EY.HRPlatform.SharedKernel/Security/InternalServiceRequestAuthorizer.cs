using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;

namespace EY.HRPlatform.SharedKernel.Security;

public sealed class InternalServiceAuthenticationOptions
{
    public const string SectionName = "InternalServiceAuthentication";
    public Dictionary<string, string> Keys { get; init; } = new(StringComparer.Ordinal);
    public string[] AllowedCallers { get; init; } = [];
    public int MaximumRequestAgeSeconds { get; init; } = 300;
}

public interface IInternalServiceRequestAuthorizer
{
    Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Generic service-to-service authentication: rotating HMAC keys, timestamp window,
/// body-bound signature, and replay prevention.
/// </summary>
public sealed class InternalServiceRequestAuthorizer(
    IMemoryCache nonceCache,
    InternalServiceAuthenticationOptions options) : IInternalServiceRequestAuthorizer
{
    public const string CallerHeader = "X-Internal-Caller";
    public const string KeyIdHeader = "X-Internal-Key-Id";
    public const string TimestampHeader = "X-Internal-Timestamp";
    public const string NonceHeader = "X-Internal-Nonce";
    public const string SignatureHeader = "X-Internal-Signature";

    public async Task<bool> AuthorizeAsync(HttpRequest request, CancellationToken cancellationToken = default)
    {
        var caller = request.Headers[CallerHeader].FirstOrDefault();
        var keyId = request.Headers[KeyIdHeader].FirstOrDefault();
        var timestampText = request.Headers[TimestampHeader].FirstOrDefault();
        var nonce = request.Headers[NonceHeader].FirstOrDefault();
        var signature = request.Headers[SignatureHeader].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(caller) || string.IsNullOrWhiteSpace(keyId) ||
            string.IsNullOrWhiteSpace(timestampText) || string.IsNullOrWhiteSpace(nonce) ||
            string.IsNullOrWhiteSpace(signature) ||
            !options.AllowedCallers.Contains(caller, StringComparer.Ordinal) ||
            !options.Keys.TryGetValue(keyId, out var secret) || string.IsNullOrWhiteSpace(secret) ||
            !long.TryParse(timestampText, out var unixTimestamp))
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        var timestamp = DateTimeOffset.FromUnixTimeSeconds(unixTimestamp);
        if (Math.Abs((now - timestamp).TotalSeconds) > options.MaximumRequestAgeSeconds)
            return false;

        var replayKey = $"internal-service-nonce:{caller}:{keyId}:{nonce}";
        if (nonceCache.TryGetValue(replayKey, out _))
            return false;

        request.EnableBuffering();
        request.Body.Position = 0;
        using var buffer = new MemoryStream();
        await request.Body.CopyToAsync(buffer, cancellationToken);
        request.Body.Position = 0;
        var bodyHash = Convert.ToHexStringLower(SHA256.HashData(buffer.ToArray()));
        var payload = string.Join('\n', caller, keyId, timestampText, nonce, request.Method, request.Path, bodyHash);
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload));

        byte[] supplied;
        try { supplied = Convert.FromHexString(signature); }
        catch (FormatException) { return false; }

        if (!CryptographicOperations.FixedTimeEquals(expected, supplied))
            return false;

        nonceCache.Set(replayKey, true, TimeSpan.FromSeconds(options.MaximumRequestAgeSeconds));
        return true;
    }
}
