using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>Immutable participant context frozen at activation from an accepted preparation candidate.</summary>
public sealed class CampaignLaunchParticipantSnapshot : BaseEntity, ITenantEntity
{
    private CampaignLaunchParticipantSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? EmployeeKey { get; private set; }
    public string? Email { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public string? OrgUnitName { get; private set; }
    public string? JobTitle { get; private set; }
    public Guid? PrimaryManagerId { get; private set; }
    public string? PrimaryManagerName { get; private set; }
    public DateTime FrozenAt { get; private set; }

    public static CampaignLaunchParticipantSnapshot FromPreparationCandidate(
        PerformanceCycleParticipant candidate,
        DateTime frozenAt)
        => new()
        {
            Id = Guid.NewGuid(),
            TenantId = candidate.TenantId,
            CycleId = candidate.CycleId,
            EmployeeId = candidate.EmployeeId,
            FullName = candidate.FullName,
            EmployeeKey = candidate.EmployeeKey,
            Email = candidate.Email,
            OrgUnitId = candidate.OrgUnitId,
            OrgUnitName = candidate.OrgUnitName,
            JobTitle = candidate.JobTitle,
            PrimaryManagerId = candidate.ManagerId,
            PrimaryManagerName = candidate.ManagerName,
            FrozenAt = frozenAt.Kind == DateTimeKind.Utc ? frozenAt : frozenAt.ToUniversalTime()
        };
}
