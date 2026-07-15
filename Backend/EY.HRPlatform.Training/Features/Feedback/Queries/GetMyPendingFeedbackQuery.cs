using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Feedback.Queries;

/// <summary>
/// Completed trainings for which the current learner has not yet submitted feedback —
/// the derived source for the in-app feedback prompt (no notification subsystem needed).
/// </summary>
public record GetMyPendingFeedbackQuery(Guid EmployeeId) : IQuery<Result<List<PendingFeedbackDto>>>;
