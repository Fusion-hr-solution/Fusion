using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Commands;

public record TogglePartLockCommand(Guid TrainingId, Guid PartId, bool Lock) : ICommand<Result>;

public class TogglePartLockCommandHandler : ICommandHandler<TogglePartLockCommand, Result>
{
    private readonly TrainingDbContext _db;

    public TogglePartLockCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(TogglePartLockCommand request, CancellationToken cancellationToken)
    {
        var part = await _db.TrainingParts
            .FirstOrDefaultAsync(p => p.Id == request.PartId && p.TrainingId == request.TrainingId, cancellationToken);

        if (part is null)
            return Result.Failure(Error.NotFound("TrainingPart", request.PartId));

        if (request.Lock)
            part.Lock();
        else
            part.Unlock();

        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
