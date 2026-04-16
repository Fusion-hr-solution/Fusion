using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record AddOnSiteCourseCommand(
    Guid TrainingId,
    string Title,
    string ContentUri,
    int OrderIndex) : ICommand<Result<Guid>>;

public record UpdateOnSiteCourseCommand(
    Guid TrainingId,
    Guid CourseId,
    string Title,
    string ContentUri) : ICommand<Result>;

public record DeleteOnSiteCourseCommand(
    Guid TrainingId,
    Guid CourseId) : ICommand<Result>;

public record ReorderOnSiteCoursesCommand(
    Guid TrainingId,
    List<Guid> CourseIds) : ICommand<Result>;
