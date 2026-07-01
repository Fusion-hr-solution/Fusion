namespace EY.HRPlatform.Performance.Features.Feedback.Dtos;

/// <summary>
/// Threshold status for a feedback cohort (per-cycle + per-subject + per-type).
/// </summary>
public sealed record FeedbackThresholdStatusDto(
    Guid CycleId,
    Guid SubjectEmployeeId,
    string FeedbackType,
    int CurrentCount,
    int MinimumRequired,
    bool IsSuppressed,
    bool IsReleased);

/// <summary>
/// List of anonymized feedback responses with suppression metadata.
/// </summary>
public sealed record FeedbackResponseListDto(
    IReadOnlyList<FeedbackResponseItemDto> Responses,
    bool IsSuppressed,
    int CurrentCount,
    int MinimumRequired);

/// <summary>
/// A single anonymized feedback response item.
/// </summary>
public sealed record FeedbackResponseItemDto(
    Guid Id,
    IReadOnlyList<FeedbackPromptAnswerDto> Answers,
    string? GeneralComment,
    DateTime SubmittedAt);

/// <summary>
/// A single prompt answer within a response.
/// </summary>
public sealed record FeedbackPromptAnswerDto(
    Guid PromptSnapshotId,
    string PromptText,
    int PromptVersion,
    string AnswerText,
    bool IsRequired);
