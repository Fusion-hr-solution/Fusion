using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpsertEmployeeProfileCommandHandler : ICommandHandler<UpsertEmployeeProfileCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpsertEmployeeProfileCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpsertEmployeeProfileCommand request, CancellationToken cancellationToken)
    {
        if (request.GradeId.HasValue)
        {
            var gradeExists = await _db.Grades
                .AnyAsync(g => g.Id == request.GradeId.Value, cancellationToken);

            if (!gradeExists)
                return Result.Failure(Error.NotFound("Grade", request.GradeId.Value));
        }

        if (request.ServiceLineId.HasValue)
        {
            var serviceLineExists = await _db.ServiceLines
                .AnyAsync(s => s.Id == request.ServiceLineId.Value, cancellationToken);

            if (!serviceLineExists)
                return Result.Failure(Error.NotFound("ServiceLine", request.ServiceLineId.Value));
        }

        var profile = await _db.EmployeeProfiles
            .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

        if (profile is null)
        {
            _db.EmployeeProfiles.Add(
                new EmployeeProfile(request.EmployeeId, request.GradeId, request.ServiceLineId));
        }
        else
        {
            profile.Update(request.GradeId, request.ServiceLineId);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
