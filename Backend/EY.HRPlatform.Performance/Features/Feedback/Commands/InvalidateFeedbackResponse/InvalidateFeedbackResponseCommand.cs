using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.InvalidateFeedbackResponse;

public sealed record InvalidateFeedbackResponseCommand(Guid ResponseContentId, string Reason) : ICommand<Result>;
