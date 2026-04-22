using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class RemoveCurriculumMappingCommandHandler : ICommandHandler<RemoveCurriculumMappingCommand, Result>
{
    private readonly TrainingDbContext _db;

    public RemoveCurriculumMappingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(RemoveCurriculumMappingCommand request, CancellationToken cancellationToken)
    {
        var mapping = await _db.CurriculumMappings.FindAsync([request.MappingId], cancellationToken);
        if (mapping is null)
            return Result.Failure(Error.NotFound("CurriculumMapping", request.MappingId));

        _db.CurriculumMappings.Remove(mapping);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
