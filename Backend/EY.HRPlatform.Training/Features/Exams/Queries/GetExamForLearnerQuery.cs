using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Exams.Queries;

public record GetExamForLearnerQuery(Guid EmployeeId, Guid TrainingId) : IQuery<Result<ExamForLearnerDto>>;
