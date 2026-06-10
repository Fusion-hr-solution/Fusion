using System.Security.Cryptography;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// One row per session. Holds the HMAC secret used to derive rotating QR payloads.
/// The displayed QR string rotates every <see cref="RotationSeconds"/> via time-window
/// math (no DB write needed each rotation). Rotating the secret invalidates all previously
/// captured QR images. Revoking blocks all scans regardless of the payload.
/// </summary>
public class SessionAttendanceToken : BaseEntity
{
    public Guid SessionId { get; private set; }
    public TrainingSession Session { get; private set; } = null!;

    /// <summary>Base64-encoded random bytes used as the HMAC key.</summary>
    public string Secret { get; private set; } = string.Empty;

    /// <summary>QR is invalid after this UTC instant (typically session.EndUtc + 30 min).</summary>
    public DateTime ValidUntil { get; private set; }

    /// <summary>How often the QR payload rotates (seconds). Default 300.</summary>
    public int RotationSeconds { get; private set; }

    public bool IsRevoked { get; private set; }
    public DateTime? RevokedAt { get; private set; }

    /// <summary>Last time the secret was (re)generated.</summary>
    public DateTime IssuedAt { get; private set; }

    private SessionAttendanceToken() { }

    public SessionAttendanceToken(Guid sessionId, DateTime validUntil, int rotationSeconds = 300)
    {
        if (rotationSeconds <= 0)
            throw new ArgumentOutOfRangeException(nameof(rotationSeconds), "Rotation seconds must be positive.");

        SessionId = sessionId;
        Secret = GenerateSecret();
        ValidUntil = validUntil;
        RotationSeconds = rotationSeconds;
        IssuedAt = DateTime.UtcNow;
        IsRevoked = false;
    }

    /// <summary>Generate a new secret (invalidates all previously captured QR images).</summary>
    public void RotateSecret(DateTime validUntil)
    {
        Secret = GenerateSecret();
        ValidUntil = validUntil;
        IssuedAt = DateTime.UtcNow;
        IsRevoked = false;
        RevokedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Revoke()
    {
        if (IsRevoked) return;
        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string GenerateSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes);
    }
}
