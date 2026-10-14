using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Population;

namespace EY.HRPlatform.Performance.Models;

public sealed record CreateReviewRoundRequest(string Name, DateOnly PeriodStart, DateOnly PeriodEnd);

public sealed record UpdateReviewRoundRequest(
    [property: JsonRequired] uint ExpectedVersion,
    string Name,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    bool SelfAssessmentEnabled,
    bool ObjectiveRatingsEnabled,
    bool CalibrationEnabled,
    DateOnly? SelfAssessmentDueDate,
    DateOnly? ManagerAssessmentDueDate,
    IReadOnlyList<Guid> CompetencyIds);

public sealed record ReviewRoundSummaryDto(
    Guid Id, Guid CycleId, string Name, DateOnly PeriodStart, DateOnly PeriodEnd,
    ReviewRoundState State, int SubjectCount, int ExcludedCount, uint Version);

public sealed record ReviewRoundSubjectDto(
    Guid ParticipantId, Guid SubjectEmployeeId, string SubjectDisplayName,
    Guid? ReviewerEmployeeId, string? ReviewerDisplayName, ReviewerBasis ReviewerBasis,
    bool IsExcluded, string? ExclusionReason, IReadOnlyList<ReviewReadinessIssueDto> ReadinessIssues);

public sealed record ReviewReadinessIssueDto(string Code, Guid SubjectEmployeeId, Guid? ReviewerEmployeeId);

public sealed record ReviewRoundDto(
    Guid Id, Guid CycleId, string Name, DateOnly PeriodStart, DateOnly PeriodEnd,
    bool SelfAssessmentEnabled, bool ObjectiveRatingsEnabled, bool CalibrationEnabled,
    DateOnly? SelfAssessmentDueDate, DateOnly? ManagerAssessmentDueDate,
    IReadOnlyList<Guid> CompetencyIds, ReviewRoundState State, uint Version,
    IReadOnlyList<ReviewRoundSubjectDto> Subjects);

public sealed record UpdateReviewRoundPopulationRequest(
    [property: JsonRequired] uint ExpectedVersion,
    IReadOnlyList<ReviewRoundPopulationSubjectRequest> Subjects);

public sealed record ReviewRoundPopulationSubjectRequest(
    Guid ParticipantId, bool IsExcluded, string? ExclusionReason, Guid? ReviewerEmployeeId);
