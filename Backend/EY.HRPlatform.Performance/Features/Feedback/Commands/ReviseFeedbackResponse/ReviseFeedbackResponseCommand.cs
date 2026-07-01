using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ReviseFeedbackResponse;

public sealed record ReviseFeedbackResponseCommand(
    Guid ResponseContentId,
    IReadOnlyList<FeedbackAnswerInput> Answers,
    string? GeneralComment) : ICommand<Result<Guid>>;
