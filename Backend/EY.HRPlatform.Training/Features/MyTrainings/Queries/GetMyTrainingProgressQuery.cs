using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public record GetMyTrainingProgressQuery(Guid EmployeeId, Guid TrainingId) : IQuery<Result<MyTrainingDto>>;
