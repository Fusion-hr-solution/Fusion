using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.MyTrainings.Commands;

public class EnrollCommandHandler : ICommandHandler<EnrollCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public EnrollCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(EnrollCommand request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure<Guid>(new Error("Training.NotFound", $"Training with id '{request.TrainingId}' was not found."));

        var existing = await _db.Assignments
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId, cancellationToken);

        if (existing)
            return Result.Failure<Guid>(new Error("Enrollment.Conflict", "You are already enrolled in this training."));

        var assignment = new TrainingAssignment(
            request.TrainingId,
            request.EmployeeId,
            AssignmentType.SelfEnroll);

        _db.Assignments.Add(assignment);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(assignment.Id);
    }
}
