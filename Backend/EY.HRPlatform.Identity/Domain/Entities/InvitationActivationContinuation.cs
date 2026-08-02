using System.Security.Cryptography;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// Short-lived, single-purpose server-side handle that preserves an activation
/// intent across an authentication interruption. It carries no reusable
/// invitation secret, so leaking a continuation cannot activate an invitation on
/// its own.
/// </summary>
public class InvitationActivationContinuation
{
    private InvitationActivationContinuation() { } // EF constructor

    public Guid Id { get; private set; }

    public Guid InvitationId { get; private set; }

    /// <summary>Digest of the continuation handle. The raw handle is never stored.</summary>
    public string HandleDigest { get; private set; } = string.Empty;

    public DateTime CreatedAt { get; private set; }

    public DateTime ExpiresAt { get; private set; }

    public DateTime? ConsumedAt { get; private set; }

    public InviteToken? Invitation { get; private set; }

    public bool IsConsumed => ConsumedAt.HasValue;

    public bool IsExpiredAt(DateTime now) => now >= ExpiresAt;

    public static InvitationActivationContinuation Create(
        Guid invitationId,
        string handleDigest,
        TimeSpan lifetime,
        DateTime? createdAt = null)
    {
        if (invitationId == Guid.Empty)
            throw new ArgumentException("Invitation ID is required.", nameof(invitationId));

        if (string.IsNullOrWhiteSpace(handleDigest))
            throw new ArgumentException("Handle digest is required.", nameof(handleDigest));

        if (lifetime <= TimeSpan.Zero)
            throw new ArgumentException("Lifetime must be positive.", nameof(lifetime));

        if (lifetime > TimeSpan.FromMinutes(30))
            throw new ArgumentException("Lifetime cannot exceed 30 minutes.", nameof(lifetime));

        var created = createdAt ?? DateTime.UtcNow;

        return new InvitationActivationContinuation
        {
            Id = Guid.NewGuid(),
            InvitationId = invitationId,
            HandleDigest = handleDigest.Trim(),
            CreatedAt = created,
            ExpiresAt = created.Add(lifetime),
        };
    }

    /// <summary>
    /// Marks the continuation used. Single use is enforced here and by the unique
    /// digest index, so a replayed handle cannot resume activation twice.
    /// </summary>
    public void Consume(DateTime? consumedAt = null)
    {
        if (IsConsumed)
            throw new InvalidOperationException("Continuation has already been consumed.");

        ConsumedAt = consumedAt ?? DateTime.UtcNow;
    }

    /// <summary>
    /// Constant-time comparison of a presented digest against the stored digest.
    /// </summary>
    public bool MatchesDigest(string presentedDigest)
    {
        if (string.IsNullOrWhiteSpace(presentedDigest))
            return false;

        return CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(HandleDigest),
            System.Text.Encoding.UTF8.GetBytes(presentedDigest.Trim()));
    }
}
