using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateGradeCommandHandler : ICommandHandler<UpdateGradeCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateGradeCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateGradeCommand request, CancellationToken cancellationToken)
    {
        var grade = await _db.Grades
            .FirstOrDefaultAsync(g => g.Id == request.GradeId, cancellationToken);

        if (grade is null)
            return Result.Failure(Error.NotFound("Grade", request.GradeId));

        var nameTaken = await _db.Grades
            .AnyAsync(g => g.Name == request.Name && g.Id != request.GradeId, cancellationToken);

        if (nameTaken)
            return Result.Failure(Error.Conflict("Grade.Duplicate",
                $"A grade with name '{request.Name}' already exists."));

        var levelTaken = await _db.Grades
            .AnyAsync(g => g.Level == request.Level && g.Id != request.GradeId, cancellationToken);

        if (levelTaken)
            return Result.Failure(Error.Conflict("Grade.LevelDuplicate",
                $"A grade with level '{request.Level}' already exists."));

        grade.Update(request.Name, request.Level, request.Description, request.Icon);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
