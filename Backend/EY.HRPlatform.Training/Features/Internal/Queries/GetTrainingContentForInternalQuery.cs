using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Internal.Queries;

/// <summary>
/// Internal (service-to-service) query: the full text content of a training, for AI ingestion.
/// </summary>
public record GetTrainingContentForInternalQuery(Guid TrainingId)
    : IQuery<Result<InternalTrainingContentDto>>;
