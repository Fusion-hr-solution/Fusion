using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Chapters.Queries;

public record GetChaptersWithProgressQuery(
    Guid EmployeeId,
    Guid TrainingId
) : IQuery<Result<List<ChapterListItemDto>>>;
