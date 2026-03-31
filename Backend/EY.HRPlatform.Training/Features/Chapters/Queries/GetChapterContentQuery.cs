using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Chapters.Queries;

public record GetChapterContentQuery(
    Guid EmployeeId,
    Guid TrainingId,
    Guid ChapterId
) : IQuery<Result<ChapterContentDto>>;
