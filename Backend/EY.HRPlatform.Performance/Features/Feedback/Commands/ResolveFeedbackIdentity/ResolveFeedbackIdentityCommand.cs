using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.ResolveFeedbackIdentity;

public sealed record ResolveFeedbackIdentityCommand(
    Guid ResponseContentId,
    string Reason) : ICommand<Result<FeedbackIdentityDto>>;
