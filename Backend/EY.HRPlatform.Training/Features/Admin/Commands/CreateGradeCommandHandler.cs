using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateGradeCommandHandler : ICommandHandler<CreateGradeCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateGradeCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateGradeCommand request, CancellationToken cancellationToken)
    {
        var nameTaken = await _db.Grades
            .AnyAsync(g => g.Name == request.Name, cancellationToken);

        if (nameTaken)
            return Result.Failure<Guid>(Error.Conflict("Grade.Duplicate",
                $"A grade with name '{request.Name}' already exists."));

        var levelTaken = await _db.Grades
            .AnyAsync(g => g.Level == request.Level, cancellationToken);

        if (levelTaken)
            return Result.Failure<Guid>(Error.Conflict("Grade.LevelDuplicate",
                $"A grade with level '{request.Level}' already exists."));

        var grade = new Grade(request.Name, request.Level, request.Description, request.Icon);
        _db.Grades.Add(grade);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(grade.Id);
    }
}
