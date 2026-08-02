namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// The completed result of one provisioning command, written inside the same
/// transaction as the tenant it describes. A receipt exists only for a committed
/// provisioning, so an identical retry can return the stored identifiers and a
/// failed transaction leaves nothing behind to reconcile.
/// </summary>
public class TenantProvisioningReceipt
{
    private TenantProvisioningReceipt() { } // EF constructor

    /// <summary>
    /// Caller-supplied key that makes provisioning idempotent. This is the
    /// identity of the receipt; a surrogate key would add a second way to name the
    /// same completed result.
    /// </summary>
    public string IdempotencyKey { get; private set; } = string.Empty;

    /// <summary>Canonical fingerprint of the request bound to the key.</summary>
    public string RequestFingerprint { get; private set; } = string.Empty;

    public Guid TenantId { get; private set; }

    public Guid BootstrapInvitationId { get; private set; }

    public DateTime CompletedAt { get; private set; }

    public static TenantProvisioningReceipt Create(
        string idempotencyKey,
        string requestFingerprint,
        Guid tenantId,
        Guid bootstrapInvitationId,
        DateTime? completedAt = null)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("Idempotency key is required.", nameof(idempotencyKey));

        if (string.IsNullOrWhiteSpace(requestFingerprint))
            throw new ArgumentException("Request fingerprint is required.", nameof(requestFingerprint));

        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        if (bootstrapInvitationId == Guid.Empty)
            throw new ArgumentException("Bootstrap invitation ID is required.", nameof(bootstrapInvitationId));

        return new TenantProvisioningReceipt
        {
            IdempotencyKey = idempotencyKey.Trim(),
            RequestFingerprint = requestFingerprint.Trim(),
            TenantId = tenantId,
            BootstrapInvitationId = bootstrapInvitationId,
            CompletedAt = completedAt ?? DateTime.UtcNow,
        };
    }
}
