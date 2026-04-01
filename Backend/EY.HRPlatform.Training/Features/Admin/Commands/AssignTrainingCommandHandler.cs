using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AssignTrainingCommandHandler : ICommandHandler<AssignTrainingCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AssignTrainingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AssignTrainingCommand request, CancellationToken cancellationToken)
    {
        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var alreadyAssigned = await _db.Assignments
            .AnyAsync(a => a.EmployeeId == request.EmployeeId && a.TrainingId == request.TrainingId,
                cancellationToken);

        if (alreadyAssigned)
            return Result.Failure<Guid>(Error.Conflict("Assignment.Duplicate",
                "This employee is already assigned to this training."));

        var assignment = new TrainingAssignment(
            request.TrainingId,
            request.EmployeeId,
            AssignmentType.HrAssigned,
            request.DueDate.HasValue ? DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc) : null);

        _db.Assignments.Add(assignment);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(assignment.Id);
    }
}
