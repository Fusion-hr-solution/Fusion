namespace EY.HRPlatform.Performance.Features.Reviews.Dtos;

public sealed record FormalReviewCriterionDto(Guid Id, string Name, string? Description, int DisplayOrder);
public sealed record FormalRatingScaleLevelDto(int Value, string Label, string? Description);
public sealed record FormalReviewResponseCriterionDto(Guid CriterionSnapshotId, int Rating, string? Comment);

public sealed record FormalReviewWorkItemDto(
    Guid WorkItemId,
    Guid CycleId,
    Guid SubjectEmployeeId,
    string Kind,
    string WorkItemStatus,
    Guid DefinitionSnapshotId,
    string DefinitionName,
    string RatingScaleName,
    IReadOnlyList<FormalReviewCriterionDto> Criteria,
    IReadOnlyList<FormalRatingScaleLevelDto> RatingScaleLevels,
    Guid? ReviewId,
    string? ReviewStatus,
    string? Narrative,
    string? EvidenceReference,
    IReadOnlyList<FormalReviewResponseCriterionDto> Responses,
    bool IsLocked,
    DateTime? FinalizedAt,
    Guid? CorrectionWorkItemId);
