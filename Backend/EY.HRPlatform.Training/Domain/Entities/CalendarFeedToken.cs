using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// A per-learner opaque feed credential. The learner subscribes to their calendar feed via a URL
/// carrying a high-entropy token; only the SHA-256 hash of that token is stored here, so the
/// plaintext URL can never be reconstructed and a leaked link is killed by rotating (overwriting)
/// the hash. At most one active (non-revoked) token per employee.
/// </summary>
public class CalendarFeedToken : BaseEntity
{
    public Guid EmployeeId { get; private set; }

    /// <summary>SHA-256 hash (base64) of the opaque feed token. The plaintext is never stored.</summary>
    public string TokenHash { get; private set; } = string.Empty;

    public DateTime? RevokedAt { get; private set; }

    public bool IsActive => RevokedAt is null;

    private CalendarFeedToken() { }

    public CalendarFeedToken(Guid employeeId, string tokenHash)
    {
        EmployeeId = employeeId;
        TokenHash = tokenHash;
    }

    /// <summary>Replace the stored hash with a freshly issued one — instantly invalidates the old URL.</summary>
    public void Rotate(string tokenHash)
    {
        TokenHash = tokenHash;
        RevokedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Revoke()
    {
        if (RevokedAt is not null) return;
        RevokedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
