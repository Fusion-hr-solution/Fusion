using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.MyTrainings.Queries;

public record GetMyTrainingsQuery(Guid EmployeeId, string? StatusFilter) : IQuery<Result<List<MyTrainingDto>>>;
