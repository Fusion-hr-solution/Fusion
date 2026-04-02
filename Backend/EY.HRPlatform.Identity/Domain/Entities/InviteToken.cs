using System.Security.Cryptography;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// Represents an invitation token for tenant-scoped user onboarding.
/// Tokens are single-use and expire after a configured period (default 7 days).
/// </summary>
public class InviteToken
{
    private InviteToken() { } // EF constructor

    public Guid Id { get; private set; }

    /// <summary>
    /// Cryptographically secure token (32-byte, base64url encoded).
    /// Used in the invite link URL.
    /// </summary>
    public string Token { get; private set; } = string.Empty;

    /// <summary>
    /// Email address the invitation is sent to.
    /// </summary>
    public string Email { get; private set; } = string.Empty;

    /// <summary>
    /// Tenant the invited user will belong to.
    /// </summary>
    public Guid TenantId { get; private set; }

    /// <summary>
    /// Navigation property to the tenant.
    /// </summary>
    public Tenant? Tenant { get; private set; }

    /// <summary>
    /// Role to assign when the invite is accepted.
    /// </summary>
    public string Role { get; private set; } = string.Empty;

    /// <summary>
    /// Optional: pre-filled first name for the invited user.
    /// </summary>
    public string? FirstName { get; private set; }

    /// <summary>
    /// Optional: pre-filled last name for the invited user.
    /// </summary>
    public string? LastName { get; private set; }

    /// <summary>
    /// When the token expires and can no longer be used.
    /// </summary>
    public DateTime ExpiresAt { get; private set; }

    /// <summary>
    /// When the invite was accepted. Null if not yet accepted.
    /// </summary>
    public DateTime? AcceptedAt { get; private set; }

    /// <summary>
    /// The user created when the invite was accepted.
    /// </summary>
    public Guid? AcceptedByUserId { get; private set; }

    /// <summary>
    /// When the invite was created.
    /// </summary>
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// The admin who created this invite.
    /// </summary>
    public Guid CreatedByUserId { get; private set; }

    /// <summary>
    /// Whether the token is still valid (not expired, not used).
    /// </summary>
    public bool IsValid => !IsExpired && !IsUsed;

    /// <summary>
    /// Whether the token has expired.
    /// </summary>
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

    /// <summary>
    /// Whether the token has already been used.
    /// </summary>
    public bool IsUsed => AcceptedAt.HasValue;

    /// <summary>
    /// Creates a new invitation token with validation.
    /// </summary>
    /// <param name="email">Email address to send the invite to.</param>
    /// <param name="tenantId">Tenant the user will belong to.</param>
    /// <param name="role">Role to assign on accept.</param>
    /// <param name="createdByUserId">Admin creating the invite.</param>
    /// <param name="firstName">Optional pre-filled first name.</param>
    /// <param name="lastName">Optional pre-filled last name.</param>
    /// <param name="expiryDays">Days until expiration (default 7).</param>
    public static InviteToken Create(
        string email,
        Guid tenantId,
        string role,
        Guid createdByUserId,
        string? firstName = null,
        string? lastName = null,
        int expiryDays = 7)
    {
        ValidateEmail(email);
        ValidateTenantId(tenantId);
        ValidateRole(role);
        ValidateCreatedBy(createdByUserId);
        ValidateExpiryDays(expiryDays);

        return new InviteToken
        {
            Id = Guid.NewGuid(),
            Token = GenerateSecureToken(),
            Email = email.Trim().ToLowerInvariant(),
            TenantId = tenantId,
            Role = role,
            FirstName = NormalizeOptionalName(firstName),
            LastName = NormalizeOptionalName(lastName),
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = createdByUserId
        };
    }

    /// <summary>
    /// Normalizes optional name: trims and converts whitespace-only to null.
    /// </summary>
    private static string? NormalizeOptionalName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;
        return name.Trim();
    }

    /// <summary>
    /// Marks the invite as accepted and records the created user.
    /// </summary>
    /// <param name="userId">The ID of the user created from this invite.</param>
    public void MarkAccepted(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("User ID cannot be empty.", nameof(userId));

        if (IsUsed)
            throw new InvalidOperationException("Invite has already been accepted.");

        if (IsExpired)
            throw new InvalidOperationException("Invite has expired.");

        AcceptedAt = DateTime.UtcNow;
        AcceptedByUserId = userId;
    }

    /// <summary>
    /// Extends the invitation expiry to a new date (default 7 days from now).
    /// Used when resending an invitation.
    /// </summary>
    /// <param name="days">Days from now to set expiry (default 7, max 90).</param>
    public void ExtendExpiry(int days = 7)
    {
        if (IsUsed)
            throw new InvalidOperationException("Cannot extend an accepted invitation.");

        ValidateExpiryDays(days);
        ExpiresAt = DateTime.UtcNow.AddDays(days);
    }

    /// <summary>
    /// Generates a cryptographically secure 32-byte token, base64url encoded.
    /// </summary>
    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Base64UrlEncode(bytes);
    }

    /// <summary>
    /// Encodes bytes as base64url (URL-safe, no padding).
    /// </summary>
    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static void ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.", nameof(email));

        // Basic email format check
        if (!email.Contains('@') || !email.Contains('.'))
            throw new ArgumentException("Invalid email format.", nameof(email));
    }

    private static void ValidateTenantId(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));
    }

    private static void ValidateRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
            throw new ArgumentException("Role is required.", nameof(role));

        if (!PlatformRole.All.Contains(role))
            throw new ArgumentException($"Invalid role: {role}", nameof(role));
    }

    private static void ValidateCreatedBy(Guid createdByUserId)
    {
        if (createdByUserId == Guid.Empty)
            throw new ArgumentException("Creator user ID is required.", nameof(createdByUserId));
    }

    private static void ValidateExpiryDays(int expiryDays)
    {
        if (expiryDays < 1)
            throw new ArgumentException("Expiry days must be at least 1.", nameof(expiryDays));

        if (expiryDays > 90)
            throw new ArgumentException("Expiry days cannot exceed 90.", nameof(expiryDays));
    }
}
