using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class ReorderCurriculumCellCommandHandler : ICommandHandler<ReorderCurriculumCellCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderCurriculumCellCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderCurriculumCellCommand request, CancellationToken cancellationToken)
    {
        if (request.MappingIds.Count == 0)
            return Result.Failure(Error.Validation("CurriculumMapping.EmptyReorderList",
                "Mapping list cannot be empty."));

        var distinctCount = request.MappingIds.Distinct().Count();
        if (distinctCount != request.MappingIds.Count)
            return Result.Failure(Error.Validation("CurriculumMapping.DuplicateIds",
                "Mapping IDs must be unique — duplicates are not allowed."));

        var mappings = await _db.CurriculumMappings
            .Where(m => m.GradeId == request.GradeId && m.ServiceLineId == request.ServiceLineId)
            .ToListAsync(cancellationToken);

        if (mappings.Count != request.MappingIds.Count)
            return Result.Failure(Error.Validation("CurriculumMapping.CountMismatch",
                $"Expected {mappings.Count} mapping IDs but received {request.MappingIds.Count}."));

        var mappingMap = mappings.ToDictionary(m => m.Id);

        for (var i = 0; i < request.MappingIds.Count; i++)
        {
            if (!mappingMap.ContainsKey(request.MappingIds[i]))
                return Result.Failure(Error.Validation("CurriculumMapping.InvalidId",
                    $"Mapping '{request.MappingIds[i]}' does not belong to this cell."));
        }

        // Two-pass save to avoid unique (GradeId, ServiceLineId, OrderIndex) conflicts
        for (var i = 0; i < mappings.Count; i++)
            mappings[i].SetOrderIndex(-(i + 1));
        await _db.SaveChangesAsync(cancellationToken);

        for (var i = 0; i < request.MappingIds.Count; i++)
            mappingMap[request.MappingIds[i]].SetOrderIndex(i);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
