using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetTrainingAssignmentsQueryHandler : IQueryHandler<GetTrainingAssignmentsQuery, Result<List<AssignmentDto>>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingAssignmentsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<AssignmentDto>>> Handle(
        GetTrainingAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var trainingExists = await _db.Trainings
            .IgnoreQueryFilters()
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<List<AssignmentDto>>(Error.NotFound("Training", request.TrainingId));

        var assignments = await _db.Assignments
            .Where(a => a.TrainingId == request.TrainingId)
            .Include(a => a.Training)
            .Select(a => new AssignmentDto
            {
                Id = a.Id,
                TrainingId = a.TrainingId,
                TrainingTitle = a.Training.Title,
                EmployeeId = a.EmployeeId,
                AssignmentType = a.AssignmentType.ToString(),
                AssignedAt = a.AssignedAt,
                DueDate = a.DueDate,
                Status = _db.TrainingProgress
                    .Where(p => p.EmployeeId == a.EmployeeId && p.TrainingId == a.TrainingId)
                    .Select(p => p.Status.ToString())
                    .FirstOrDefault(),
                ProgressPercentage = _db.TrainingProgress
                    .Where(p => p.EmployeeId == a.EmployeeId && p.TrainingId == a.TrainingId)
                    .Select(p => p.ProgressPercentage)
                    .FirstOrDefault()
            })
            .OrderByDescending(a => a.AssignedAt)
            .ToListAsync(cancellationToken);

        return Result.Success(assignments);
    }
}
