using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// One append-only progress record against a locked employee objective. The progress percent is
/// the canonical value for every measurement method; the previous latest percent is snapshotted at
/// write time so each row narrates its own transition. Rows are never modified or deleted
/// (enforced by <see cref="Infrastructure.Persistence.PerformanceDbContext"/>) — corrections happen
/// through a new traced update.
/// </summary>
public sealed class ObjectiveProgressUpdate : BaseEntity, ITenantEntity
{
    public const int ActualValueMaxLength = 120;
    public const int CommentMaxLength = 500;
    public const int RegressionReasonMaxLength = 300;

    private ObjectiveProgressUpdate() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid PlanId { get; private set; }
    public Guid ObjectiveId { get; private set; }

    /// <summary>The owning employee — always the actor's employee identity; no other role records progress.</summary>
    public Guid EmployeeId { get; private set; }

    /// <summary>Canonical progress value, 0–100, asserted by the employee for any measurement method.</summary>
    public int ProgressPercent { get; private set; }

    /// <summary>The latest percent at write time; null for the objective's first update.</summary>
    public int? PreviousPercent { get; private set; }

    /// <summary>Optional "actual result so far" context for Quantitative objectives; never used to derive the percent.</summary>
    public string? ActualValue { get; private set; }

    public string? Comment { get; private set; }

    /// <summary>True when this update lowered the value; such updates always carry a reason.</summary>
    public bool IsRegression { get; private set; }

    public string? RegressionReason { get; private set; }

    public Guid ActorUserId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;

    /// <summary>Business timestamp of the recording (UTC); ordering key together with Id.</summary>
    public DateTime RecordedAt { get; private set; }

    internal static ObjectiveProgressUpdate Create(
        Guid tenantId,
        Guid cycleId,
        Guid planId,
        Guid objectiveId,
        Guid employeeId,
        int progressPercent,
        int? previousPercent,
        string? actualValue,
        string? comment,
        bool isRegression,
        string? regressionReason,
        Guid actorUserId,
        string actorName,
        DateTime recordedAt)
    {
        if (string.IsNullOrWhiteSpace(actorName))
            throw new ArgumentException("Actor name is required.", nameof(actorName));

        return new ObjectiveProgressUpdate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            PlanId = planId,
            ObjectiveId = objectiveId,
            EmployeeId = employeeId,
            ProgressPercent = progressPercent,
            PreviousPercent = previousPercent,
            ActualValue = string.IsNullOrWhiteSpace(actualValue) ? null : actualValue.Trim(),
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            IsRegression = isRegression,
            RegressionReason = string.IsNullOrWhiteSpace(regressionReason) ? null : regressionReason.Trim(),
            ActorUserId = actorUserId,
            ActorName = actorName.Trim(),
            RecordedAt = recordedAt,
        };
    }
}
