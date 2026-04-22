using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class BulkAssignCurriculumCommandHandler : ICommandHandler<BulkAssignCurriculumCommand, Result<int>>
{
    private readonly TrainingDbContext _db;

    public BulkAssignCurriculumCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<int>> Handle(BulkAssignCurriculumCommand request, CancellationToken cancellationToken)
    {
        var noGrades = request.GradeIds is null || request.GradeIds.Count == 0;
        var noServiceLines = request.ServiceLineIds is null || request.ServiceLineIds.Count == 0;

        if (noGrades && noServiceLines)
            return Result.Failure<int>(Error.Validation("BulkAssign.EmptyScope",
                "At least one of gradeIds or serviceLineIds must be provided."));

        var trainingExists = await _db.Trainings.AnyAsync(t => t.Id == request.TrainingId, cancellationToken);
        if (!trainingExists)
            return Result.Failure<int>(Error.NotFound("Training", request.TrainingId));

        // Resolve target grades
        List<Guid> gradeIds;
        if (noGrades)
            gradeIds = await _db.Grades.Select(g => g.Id).ToListAsync(cancellationToken);
        else
            gradeIds = request.GradeIds!;

        // Resolve target service lines
        List<Guid> serviceLineIds;
        if (noServiceLines)
            serviceLineIds = await _db.ServiceLines.Select(s => s.Id).ToListAsync(cancellationToken);
        else
            serviceLineIds = request.ServiceLineIds!;

        // Load existing mappings for this training to skip duplicates
        var existingPairs = await _db.CurriculumMappings
            .Where(m => m.TrainingId == request.TrainingId)
            .Select(m => new { m.GradeId, m.ServiceLineId })
            .ToListAsync(cancellationToken);

        var existingSet = new HashSet<(Guid, Guid)>(existingPairs.Select(p => (p.GradeId, p.ServiceLineId)));

        var created = 0;
        foreach (var gradeId in gradeIds)
        {
            foreach (var serviceLineId in serviceLineIds)
            {
                if (existingSet.Contains((gradeId, serviceLineId)))
                    continue;

                var nextOrderIndex = await _db.CurriculumMappings
                    .Where(m => m.GradeId == gradeId && m.ServiceLineId == serviceLineId)
                    .Select(m => (int?)m.OrderIndex)
                    .MaxAsync(cancellationToken) + 1 ?? 0;

                _db.CurriculumMappings.Add(new CurriculumMapping(
                    gradeId, serviceLineId, request.TrainingId, request.IsRequired, nextOrderIndex));

                created++;
            }
        }

        if (created > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(created);
    }
}
