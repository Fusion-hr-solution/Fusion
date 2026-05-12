using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Commands;

public record DeletePartCommand(Guid TrainingId, Guid PartId) : ICommand<Result>;

public class DeletePartCommandHandler : ICommandHandler<DeletePartCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeletePartCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeletePartCommand request, CancellationToken cancellationToken)
    {
        var part = await _db.TrainingParts
            .Include(p => p.Sessions)
            .FirstOrDefaultAsync(p => p.Id == request.PartId && p.TrainingId == request.TrainingId, cancellationToken);

        if (part is null)
            return Result.Failure(Error.NotFound("TrainingPart", request.PartId));

        _db.TrainingParts.Remove(part);
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
