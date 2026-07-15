using System.Security.Cryptography;
using System.Text;

namespace EY.HRPlatform.Training.Features.Calendar.Feed;

/// <summary>
/// Issues and hashes per-learner calendar feed tokens. The token is a 256-bit URL-safe secret
/// (the bearer credential in the webcal URL); only its SHA-256 hash is ever persisted.
/// </summary>
public interface ICalendarFeedTokenService
{
    /// <summary>Generate a fresh opaque token and the hash to store for it.</summary>
    (string Token, string Hash) Issue();

    /// <summary>Hash a presented token for constant-scheme lookup against the stored hash.</summary>
    string Hash(string token);
}

public sealed class CalendarFeedTokenService : ICalendarFeedTokenService
{
    public (string Token, string Hash) Issue()
    {
        var token = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        return (token, Hash(token));
    }

    public string Hash(string token)
        => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64UrlEncode(byte[] data)
        => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
