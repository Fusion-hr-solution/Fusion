using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class EmployeeObjective : BaseEntity
{
    public const int TitleMaxLength = 150;
    public const int DescriptionMaxLength = 500;
    public const int AlignmentTitleMaxLength = 200;
    public const int MeasurementMethodMaxLength = 50;
    public const int MeasurementIndicatorMaxLength = 200;
    public const int TargetValueMaxLength = 80;
    public const int TargetUnitMaxLength = 40;
    public const int SuccessCriteriaMaxLength = 500;

    private EmployeeObjective() { }

    public Guid PlanId { get; private set; }
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

    internal static EmployeeObjective Create(
        Guid planId,
        string title,
        string? description,
        ObjectiveAlignmentType? alignmentType,
        Guid? alignmentTargetId,
        string? alignmentTitle,
        int? weight,
        DateTime? deadline,
        string? measurementMethod,
        string? measurementIndicator,
        string? targetValue,
        string? targetUnit,
        string? successCriteria)
    {
        var objective = new EmployeeObjective { Id = Guid.NewGuid(), PlanId = planId };
        objective.Update(
            title,
            description,
            alignmentType,
            alignmentTargetId,
            alignmentTitle,
            weight,
            deadline,
            measurementMethod,
            measurementIndicator,
            targetValue,
            targetUnit,
            successCriteria);
        return objective;
    }

    internal void Update(
        string title,
        string? description,
        ObjectiveAlignmentType? alignmentType,
        Guid? alignmentTargetId,
        string? alignmentTitle,
        int? weight,
        DateTime? deadline,
        string? measurementMethod,
        string? measurementIndicator,
        string? targetValue,
        string? targetUnit,
        string? successCriteria)
    {
        Title = NormalizeRequired(title, nameof(title), TitleMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        AlignmentType = alignmentType;
        AlignmentTargetId = alignmentTargetId;
        AlignmentTitle = NormalizeOptional(alignmentTitle, nameof(alignmentTitle), AlignmentTitleMaxLength);
        Weight = weight;
        Deadline = deadline is null ? null : NormalizeUtc(deadline.Value, nameof(deadline));
        MeasurementMethod = NormalizeOptional(measurementMethod, nameof(measurementMethod), MeasurementMethodMaxLength);
        MeasurementIndicator = NormalizeOptional(measurementIndicator, nameof(measurementIndicator), MeasurementIndicatorMaxLength);
        TargetValue = NormalizeOptional(targetValue, nameof(targetValue), TargetValueMaxLength);
        TargetUnit = NormalizeOptional(targetUnit, nameof(targetUnit), TargetUnitMaxLength);
        SuccessCriteria = NormalizeOptional(successCriteria, nameof(successCriteria), SuccessCriteriaMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    internal bool HasAlignment => AlignmentType.HasValue && AlignmentTargetId.HasValue && AlignmentTargetId != Guid.Empty;

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} is required.", paramName);

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static DateTime NormalizeUtc(DateTime value, string paramName)
    {
        if (value == default)
            throw new ArgumentException("A valid date is required.", paramName);

        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
