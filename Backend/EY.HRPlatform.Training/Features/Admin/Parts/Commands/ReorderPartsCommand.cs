using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Commands;

public record ReorderPartsCommand(Guid TrainingId, List<Guid> PartIds) : ICommand<Result>;

public class ReorderPartsCommandHandler : ICommandHandler<ReorderPartsCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ReorderPartsCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ReorderPartsCommand request, CancellationToken cancellationToken)
    {
        var parts = await _db.TrainingParts
            .Where(p => p.TrainingId == request.TrainingId)
            .ToListAsync(cancellationToken);

        if (parts.Count == 0)
            return Result.Failure(Error.NotFound("Training", request.TrainingId));

        // Two-pass write to avoid colliding on the unique index { TrainingId, OrderIndex }.
        for (var i = 0; i < parts.Count; i++)
            parts[i].Reorder(-(i + 1));
        await _db.SaveChangesAsync(cancellationToken);

        for (var i = 0; i < request.PartIds.Count; i++)
        {
            var part = parts.FirstOrDefault(p => p.Id == request.PartIds[i]);
            part?.Reorder(i);
        }
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
