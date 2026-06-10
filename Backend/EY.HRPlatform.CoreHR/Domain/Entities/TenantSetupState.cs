using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class TenantSetupState : BaseEntity, ITenantEntity
{
    private TenantSetupState() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    public TenantSetupPhase CurrentPhase { get; private set; }

    public DateTime? ActivatedAt { get; private set; }

    public DateTime? StructurallyGovernedAt { get; private set; }

    public DateTime? ApprovedAt { get; private set; }

    public Guid? ApprovedByUserId { get; private set; }

    public string? ApprovedByFullName { get; private set; }

    public string? ApprovedByRole { get; private set; }

    public bool IsApprovedInPlatformAssistMode { get; private set; }

    public DateTime? StructurallyPublishedAt { get; private set; }

    public int PublishedStructureVersion { get; private set; }

    public DateTime? OperationalAt { get; private set; }

    public ICollection<TenantSetupActivity> Activities { get; private set; } = new List<TenantSetupActivity>();

    public static TenantSetupState CreateActivated(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new TenantSetupState
        {
            TenantId = tenantId,
            CurrentPhase = TenantSetupPhase.Activated,
            ActivatedAt = DateTime.UtcNow
        };
    }

    public void EnsureActivated()
    {
        if (CurrentPhase != TenantSetupPhase.NotStarted)
            return;

        CurrentPhase = TenantSetupPhase.Activated;
        ActivatedAt ??= DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(
        Guid actorUserId,
        string actorFullName,
        string actorRole,
        bool isPlatformAssisted)
    {
        if (CurrentPhase != TenantSetupPhase.Activated)
        {
            throw new InvalidOperationException("Only an active draft can be approved.");
        }

        if (actorUserId == Guid.Empty)
        {
            throw new ArgumentException("Actor user id cannot be empty.", nameof(actorUserId));
        }

        if (string.IsNullOrWhiteSpace(actorFullName))
        {
            throw new ArgumentException("Actor full name is required.", nameof(actorFullName));
        }

        if (string.IsNullOrWhiteSpace(actorRole))
        {
            throw new ArgumentException("Actor role is required.", nameof(actorRole));
        }

        var approvedAt = DateTime.UtcNow;

        CurrentPhase = TenantSetupPhase.StructurallyGoverned;
        StructurallyGovernedAt = approvedAt;
        ApprovedAt = approvedAt;
        ApprovedByUserId = actorUserId;
        ApprovedByFullName = actorFullName.Trim();
        ApprovedByRole = actorRole.Trim();
        IsApprovedInPlatformAssistMode = isPlatformAssisted;
        UpdatedAt = approvedAt;
    }

    public void Reopen()
    {
        if (CurrentPhase != TenantSetupPhase.StructurallyGoverned
            && CurrentPhase != TenantSetupPhase.StructurallyPublished
            && CurrentPhase != TenantSetupPhase.Operational)
        {
            throw new InvalidOperationException("Only an approved or published structure can be reopened.");
        }

        CurrentPhase = TenantSetupPhase.Activated;
        StructurallyGovernedAt = null;
        ApprovedAt = null;
        ApprovedByUserId = null;
        ApprovedByFullName = null;
        ApprovedByRole = null;
        IsApprovedInPlatformAssistMode = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Publish()
    {
        if (CurrentPhase != TenantSetupPhase.Activated
            && CurrentPhase != TenantSetupPhase.StructurallyGoverned)
        {
            throw new InvalidOperationException("Only an active draft can be published.");
        }

        var publishedAt = DateTime.UtcNow;

        CurrentPhase = TenantSetupPhase.StructurallyPublished;
        StructurallyPublishedAt = publishedAt;
        PublishedStructureVersion += 1;
        UpdatedAt = publishedAt;
    }

    public void Complete()
    {
        if (CurrentPhase != TenantSetupPhase.StructurallyPublished)
        {
            throw new InvalidOperationException("Only a published structure can complete setup.");
        }

        var completedAt = DateTime.UtcNow;

        CurrentPhase = TenantSetupPhase.Operational;
        OperationalAt = completedAt;
        UpdatedAt = completedAt;
    }
}
