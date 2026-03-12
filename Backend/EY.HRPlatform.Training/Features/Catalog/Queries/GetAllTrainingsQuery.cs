using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Catalog.Queries;

public record GetAllTrainingsQuery(Guid? CategoryId, string? Search) : IQuery<Result<List<TrainingDto>>>;
