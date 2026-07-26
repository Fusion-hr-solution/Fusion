using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EvaluationObjectivePlanSnapshot : BaseEntity, ITenantEntity
{
    private readonly List<EvaluationObjectiveSnapshot> _objectives = new();
    private EvaluationObjectivePlanSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid RoundId { get; private set; }
    public Guid ParticipantEmployeeId { get; private set; }
    public Guid SourceObjectivePlanId { get; private set; }
    public DateTime ApprovedAt { get; private set; }
    public IReadOnlyCollection<EvaluationObjectiveSnapshot> Objectives => _objectives.AsReadOnly();

    internal static EvaluationObjectivePlanSnapshot Capture(
        Guid tenantId,
        Guid roundId,
        EmployeeObjectivePlan plan)
    {
        var snapshot = new EvaluationObjectivePlanSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoundId = roundId,
            ParticipantEmployeeId = plan.EmployeeId,
            SourceObjectivePlanId = plan.Id,
            ApprovedAt = plan.ApprovedAt!.Value
        };
        snapshot._objectives.AddRange(plan.Objectives.Select(objective =>
            EvaluationObjectiveSnapshot.Capture(tenantId, snapshot.Id, objective)));
        return snapshot;
    }
}

public sealed class EvaluationObjectiveSnapshot : BaseEntity, ITenantEntity
{
    private EvaluationObjectiveSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid ObjectivePlanSnapshotId { get; private set; }
    public Guid SourceObjectiveId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public ObjectiveAlignmentType? AlignmentType { get; private set; }
    public Guid? AlignmentTargetId { get; private set; }
    public string? AlignmentTitle { get; private set; }
    public int? Weight { get; private set; }
    public DateTime? Deadline { get; private set; }
    public string? MeasurementMethod { get; private set; }
    public string? MeasurementIndicator { get; private set; }
    public string? TargetValue { get; private set; }
    public string? TargetUnit { get; private set; }
    public string? SuccessCriteria { get; private set; }

    internal static EvaluationObjectiveSnapshot Capture(
        Guid tenantId,
        Guid objectivePlanSnapshotId,
        EmployeeObjective objective) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ObjectivePlanSnapshotId = objectivePlanSnapshotId,
            SourceObjectiveId = objective.Id,
            Title = objective.Title,
            Description = objective.Description,
            AlignmentType = objective.AlignmentType,
            AlignmentTargetId = objective.AlignmentTargetId,
            AlignmentTitle = objective.AlignmentTitle,
            Weight = objective.Weight,
            Deadline = objective.Deadline,
            MeasurementMethod = objective.MeasurementMethod,
            MeasurementIndicator = objective.MeasurementIndicator,
            TargetValue = objective.TargetValue,
            TargetUnit = objective.TargetUnit,
            SuccessCriteria = objective.SuccessCriteria
        };
}
