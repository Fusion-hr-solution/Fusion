using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AddOnSiteCourseCommandHandler : ICommandHandler<AddOnSiteCourseCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddOnSiteCourseCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddOnSiteCourseCommand request, CancellationToken cancellationToken)
    {
        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId && !t.IsDeleted, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var orderIndex = await _db.OnSiteCourses
            .CountAsync(c => c.TrainingId == request.TrainingId, cancellationToken);

        var course = new OnSiteCourse(request.Title, request.ContentUri, orderIndex, request.TrainingId);
        _db.OnSiteCourses.Add(course);

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success(course.Id);
    }
}

public class UpdateOnSiteCourseCommandHandler : ICommandHandler<UpdateOnSiteCourseCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateOnSiteCourseCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateOnSiteCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _db.OnSiteCourses
            .FirstOrDefaultAsync(c => c.Id == request.CourseId && c.TrainingId == request.TrainingId, cancellationToken);

        if (course is null)
            return Result.Failure(Error.NotFound("OnSiteCourse", request.CourseId));

        course.Update(request.Title, request.ContentUri);
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public class DeleteOnSiteCourseCommandHandler : ICommandHandler<DeleteOnSiteCourseCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteOnSiteCourseCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteOnSiteCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _db.OnSiteCourses
            .FirstOrDefaultAsync(c => c.Id == request.CourseId && c.TrainingId == request.TrainingId, cancellationToken);

        if (course is null)
            return Result.Failure(Error.NotFound("OnSiteCourse", request.CourseId));

        _db.OnSiteCourses.Remove(course);
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

public class ReorderOnSiteCoursesCommandHandler : ICommandHandler<ReorderOnSiteCoursesCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderOnSiteCoursesCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderOnSiteCoursesCommand request, CancellationToken cancellationToken)
    {
        var courses = await _db.OnSiteCourses
            .Where(c => c.TrainingId == request.TrainingId)
            .ToListAsync(cancellationToken);

        for (var i = 0; i < request.CourseIds.Count; i++)
        {
            var course = courses.FirstOrDefault(c => c.Id == request.CourseIds[i]);
            course?.Reorder(i);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
