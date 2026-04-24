using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteGradeCommandHandler : ICommandHandler<DeleteGradeCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteGradeCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteGradeCommand request, CancellationToken cancellationToken)
    {
        var grade = await _db.Grades
            .FirstOrDefaultAsync(g => g.Id == request.GradeId, cancellationToken);

        if (grade is null)
            return Result.Failure(Error.NotFound("Grade", request.GradeId));

        var hasProfiles = await _db.EmployeeProfiles
            .AnyAsync(p => p.GradeId == request.GradeId, cancellationToken);

        if (hasProfiles)
            return Result.Failure(Error.Validation("Grade.HasProfiles",
                "Cannot delete a grade that is assigned to one or more employees. Reassign them first."));

        _db.Grades.Remove(grade);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
