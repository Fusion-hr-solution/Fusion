using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Exams.Queries;

public record GetMyExamAttemptsQuery(Guid EmployeeId, Guid TrainingId) : IQuery<Result<List<ExamAttemptDto>>>;
