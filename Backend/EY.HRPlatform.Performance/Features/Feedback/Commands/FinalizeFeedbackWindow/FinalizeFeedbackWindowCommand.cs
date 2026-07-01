using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Feedback.Commands.FinalizeFeedbackWindow;

public sealed record FinalizeFeedbackWindowCommand(
    Guid CycleId,
    string FeedbackType,
    Guid SubjectEmployeeId) : ICommand<Result>;
