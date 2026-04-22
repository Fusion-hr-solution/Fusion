using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class AddCurriculumMappingCommandHandler : ICommandHandler<AddCurriculumMappingCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddCurriculumMappingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddCurriculumMappingCommand request, CancellationToken cancellationToken)
    {
        var gradeExists = await _db.Grades.AnyAsync(g => g.Id == request.GradeId, cancellationToken);
        if (!gradeExists)
            return Result.Failure<Guid>(Error.NotFound("Grade", request.GradeId));

        var serviceLineExists = await _db.ServiceLines.AnyAsync(s => s.Id == request.ServiceLineId, cancellationToken);
        if (!serviceLineExists)
            return Result.Failure<Guid>(Error.NotFound("ServiceLine", request.ServiceLineId));

        var trainingExists = await _db.Trainings.AnyAsync(t => t.Id == request.TrainingId, cancellationToken);
        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var duplicateExists = await _db.CurriculumMappings
            .AnyAsync(m => m.GradeId == request.GradeId
                        && m.ServiceLineId == request.ServiceLineId
                        && m.TrainingId == request.TrainingId, cancellationToken);
        if (duplicateExists)
            return Result.Failure<Guid>(Error.Conflict("CurriculumMapping.Duplicate",
                "This training is already mapped to this grade and service line combination."));

        var orderIndex = request.OrderIndex ?? await _db.CurriculumMappings
            .Where(m => m.GradeId == request.GradeId && m.ServiceLineId == request.ServiceLineId)
            .Select(m => (int?)m.OrderIndex)
            .MaxAsync(cancellationToken) + 1 ?? 0;

        var mapping = new CurriculumMapping(
            request.GradeId, request.ServiceLineId, request.TrainingId, request.IsRequired, orderIndex);

        _db.CurriculumMappings.Add(mapping);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(mapping.Id);
    }
}
