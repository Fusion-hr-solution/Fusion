using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Training.Domain.Entities;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Services;

/// <summary>
/// Builds and validates rotating QR payloads using HMAC-SHA256 over a per-session secret
/// and a time window index. The displayed QR rotates every <c>RotationSeconds</c> without
/// any DB writes; validation accepts the current and previous window for grace.
/// </summary>
public interface IQrTokenService
{
    /// <summary>Build the QR payload string for the current time window.</summary>
    QrPayloadInfo Build(SessionAttendanceToken token, DateTime nowUtc);

    /// <summary>
    /// Validate a payload string against the stored token. Accepts current and previous window.
    /// </summary>
    QrValidationResult Validate(string payload, SessionAttendanceToken token, DateTime nowUtc);

    /// <summary>Try parse the payload to extract the SessionId without secret check.</summary>
    bool TryParseSessionId(string payload, out Guid sessionId);
}

public sealed record QrPayloadInfo(string Payload, long WindowIndex, DateTime IssuedAt, DateTime RefreshAt);

public enum QrValidationOutcome
{
    Valid,
    Malformed,
    SessionMismatch,
    Expired,
    WindowOutOfRange,
    Revoked,
}

public sealed record QrValidationResult(QrValidationOutcome Outcome, long WindowIndex)
{
    public bool IsValid => Outcome == QrValidationOutcome.Valid;
}

public sealed class QrTokenService : IQrTokenService
{
    private const string PayloadVersion = "v1";

    public QrPayloadInfo Build(SessionAttendanceToken token, DateTime nowUtc)
    {
        var window = ComputeWindowIndex(nowUtc, token.RotationSeconds);
        var signature = ComputeSignature(token.Secret, token.SessionId, window);
        var payload = $"{PayloadVersion}.{token.SessionId:N}.{window}.{signature}";
        var refreshAt = WindowStart(window + 1, token.RotationSeconds);
        var issuedAt = WindowStart(window, token.RotationSeconds);
        return new QrPayloadInfo(payload, window, issuedAt, refreshAt);
    }

    public QrValidationResult Validate(string payload, SessionAttendanceToken token, DateTime nowUtc)
    {
        if (!TryParse(payload, out var sessionId, out var window, out var signature))
            return new QrValidationResult(QrValidationOutcome.Malformed, 0);

        if (sessionId != token.SessionId)
            return new QrValidationResult(QrValidationOutcome.SessionMismatch, window);

        if (token.IsRevoked)
            return new QrValidationResult(QrValidationOutcome.Revoked, window);

        if (nowUtc > token.ValidUntil)
            return new QrValidationResult(QrValidationOutcome.Expired, window);

        var currentWindow = ComputeWindowIndex(nowUtc, token.RotationSeconds);
        if (window != currentWindow && window != currentWindow - 1)
            return new QrValidationResult(QrValidationOutcome.WindowOutOfRange, window);

        var expected = ComputeSignature(token.Secret, token.SessionId, window);
        if (!FixedTimeEquals(expected, signature))
            return new QrValidationResult(QrValidationOutcome.WindowOutOfRange, window);

        return new QrValidationResult(QrValidationOutcome.Valid, window);
    }

    public bool TryParseSessionId(string payload, out Guid sessionId)
        => TryParse(payload, out sessionId, out _, out _);

    private static bool TryParse(string payload, out Guid sessionId, out long window, out string signature)
    {
        sessionId = Guid.Empty;
        window = 0;
        signature = string.Empty;

        if (string.IsNullOrWhiteSpace(payload)) return false;
        var parts = payload.Split('.');
        if (parts.Length != 4) return false;
        if (parts[0] != PayloadVersion) return false;
        if (!Guid.TryParseExact(parts[1], "N", out sessionId)) return false;
        if (!long.TryParse(parts[2], out window)) return false;
        signature = parts[3];
        return signature.Length > 0;
    }

    private static long ComputeWindowIndex(DateTime nowUtc, int rotationSeconds)
    {
        var unixSeconds = new DateTimeOffset(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc)).ToUnixTimeSeconds();
        return unixSeconds / rotationSeconds;
    }

    private static DateTime WindowStart(long windowIndex, int rotationSeconds)
        => DateTimeOffset.FromUnixTimeSeconds(windowIndex * rotationSeconds).UtcDateTime;

    private static string ComputeSignature(string secretBase64, Guid sessionId, long window)
    {
        var key = Convert.FromBase64String(secretBase64);
        var message = Encoding.UTF8.GetBytes($"{sessionId:N}:{window}");
        using var hmac = new HMACSHA256(key);
        var hash = hmac.ComputeHash(message);
        return Base64UrlEncode(hash);
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    private static string Base64UrlEncode(byte[] data)
        => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
