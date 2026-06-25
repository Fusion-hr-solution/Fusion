using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Feedback.Commands;

/// <summary>
/// Submit a learner's feedback for a completed training. One per (employee, training);
/// immutable once submitted (see ADR 0006). Returns the new feedback id.
/// </summary>
public record SubmitFeedbackCommand(
    Guid EmployeeId,
    Guid TrainingId,
    int OverallRating,
    int ContentRating,
    int RelevanceRating,
    bool WouldRecommend,
    int? TrainerRating,
    string? Comment,
    string? Suggestions,
    bool IsAnonymous) : ICommand<Result<Guid>>;
