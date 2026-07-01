using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.WithdrawFeedbackResponse;

public sealed record WithdrawFeedbackResponseCommand(Guid ResponseContentId) : ICommand<Result>;
