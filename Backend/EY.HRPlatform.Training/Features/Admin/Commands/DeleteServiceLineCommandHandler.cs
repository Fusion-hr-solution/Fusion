using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteServiceLineCommandHandler : ICommandHandler<DeleteServiceLineCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteServiceLineCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteServiceLineCommand request, CancellationToken cancellationToken)
    {
        var serviceLine = await _db.ServiceLines
            .FirstOrDefaultAsync(s => s.Id == request.ServiceLineId, cancellationToken);

        if (serviceLine is null)
            return Result.Failure(Error.NotFound("ServiceLine", request.ServiceLineId));

        var hasProfiles = await _db.EmployeeProfiles
            .AnyAsync(p => p.ServiceLineId == request.ServiceLineId, cancellationToken);

        if (hasProfiles)
            return Result.Failure(Error.Validation("ServiceLine.HasProfiles",
                "Cannot delete a service line that is assigned to one or more employees. Reassign them first."));

        _db.ServiceLines.Remove(serviceLine);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
