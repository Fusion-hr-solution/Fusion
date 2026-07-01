namespace EY.HRPlatform.Training.Domain.Enums;

/// <summary>
/// Granularity preset for a <see cref="Entities.TrainingBudget"/> period. Annual and Quarterly
/// are conveniences that fill the start/end dates; Custom is an arbitrary date range.
/// </summary>
public enum PeriodType
{
    Annual,
    Quarterly,
    Custom
}
