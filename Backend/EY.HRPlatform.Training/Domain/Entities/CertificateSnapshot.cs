namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// The set of values frozen onto a <see cref="Certification"/> at issuance. Captured once from
/// the employee and the formation as they were at completion; never re-read live afterwards.
/// </summary>
public sealed record CertificateSnapshot(
    Guid EmployeeId,
    string EmployeeFullName,
    Guid? GradeId,
    string? GradeName,
    Guid? ServiceLineId,
    string? ServiceLineName,
    Guid TrainingId,
    string TrainingTitle,
    string? TrainingDescription,
    int Credits,
    string? Duration,
    string? TrainerName,
    DateTime CompletedAt);
