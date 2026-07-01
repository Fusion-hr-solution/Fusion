using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.SubmitFeedbackResponse;

public sealed record SubmitFeedbackResponseCommand(
    Guid WorkItemId,
    IReadOnlyList<FeedbackAnswerInput> Answers,
    string? GeneralComment) : ICommand<Result<Guid>>;
