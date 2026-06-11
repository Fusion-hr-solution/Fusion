using EY.HRPlatform.Interview.Domain.Enums;

namespace EY.HRPlatform.Interview.Features.Grading.Dtos;

public record GradingResultDto(
    Guid AttemptId,
    decimal TotalScore,
    decimal MaxScore,
    GradingStatus Status,
    IReadOnlyList<QuestionGradeResultDto> QuestionResults
);

public record QuestionGradeResultDto(
    Guid QuestionId,
    string GraderType,
    decimal Score,
    decimal MaxScore,
    string? Feedback,
    bool NeedsHumanReview
);

public record ReviewQueueItemDto(
    Guid ResultId,
    Guid AttemptId,
    string CandidateName,
    string QuestionTitle,
    string QuestionText,
    string CandidateAnswer,
    string? AiSuggestedFeedback,
    decimal AiSuggestedScore,
    decimal MaxScore
);

public record ApproveReviewRequest(decimal Score);
