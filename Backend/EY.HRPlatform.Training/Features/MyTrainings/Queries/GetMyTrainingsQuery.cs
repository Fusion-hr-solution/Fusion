using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public record GetMyTrainingsQuery(Guid EmployeeId, TrainingStatus? StatusFilter) : IQuery<Result<List<MyTrainingDto>>>;
